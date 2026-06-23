import React from 'react';
import { Table, Input } from 'antd';
import { inject, observer } from 'mobx-react';
import { StepAction } from 'containers/Action';
import globalServerStore from 'stores/nova/instance';
import globalProjectStore from 'stores/keystone/project';
import Notify from 'components/Notify';
import axios from 'axios';
import globalRootStore from 'stores/root';
import { isEmpty } from 'lodash';

const API = 'http://192.168.10.10:8003';

const DEFAULT_NETWORK_NAME = 'highcloud-shared-net'; 

const getAuthHeaders = () => {
  const rawToken = localStorage.getItem('keystone_token');
  let cleanToken = '';
  if (rawToken) {
    try {
      const tokenObj = JSON.parse(rawToken);
      cleanToken = tokenObj.value || '';
    } catch (e) {
      cleanToken = rawToken;
    }
  }
  const projectId = globalRootStore.projectId || '';
  return {
    'X-Auth-Token': cleanToken,
    'X-Project-Id': projectId,
  };
};

const flavorColumns = [
  { title: '이름', dataIndex: 'label' },
  { title: 'CPU', dataIndex: 'vcpu', render: v => `${v} Core` },
  { title: '메모리', dataIndex: 'ram' },
  { title: '디스크', dataIndex: 'disk_label' },
];

const imageColumns = [
  { title: '이름', dataIndex: 'label' },
  { title: '접근 제어', dataIndex: 'visibility' },
  { title: '크기', dataIndex: 'size' },
];

const labelStyle = {
  width: 150,
  fontSize: 14,
  fontWeight: 'bold',
  color: '#222',
  paddingTop: 6,
  display: 'flex',
  alignItems: 'center',
};

const requiredStar = <span style={{ color: '#ff4d4f', marginLeft: 4, fontSize: 16 }}>*</span>;

@inject('rootStore')
@observer
class OneClickForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      flavors: [],
      images: [],
      vmName: '',
      selectedFlavorKey: null,
      selectedImageKey: null,
    };
  }

  checkFormInput = (callback) => {
    const { vmName, selectedFlavorKey, selectedImageKey } = this.state;
    if (!vmName || !selectedFlavorKey || !selectedImageKey) {
      Notify.error('이름, 인스턴스 유형, OS 이미지를 모두 선택해주세요.');
      return;
    }
    callback();
  };

  componentDidMount() {
    console.log('props:', this.props);
    const headers = getAuthHeaders();

    axios.get(`${API}/flavors`, { headers: getAuthHeaders() }).then(res => 
      this.setState({ flavors: res.data.filter(f => f.disk > 0) })
    );
    axios.get(`${API}/images`, { headers: getAuthHeaders() }).then(res => this.setState({ images: res.data }));
    
    axios.get(`${API}/networks`, { headers })
      .then(res => {
        const defaultNet = res.data.find(net => net.name === DEFAULT_NETWORK_NAME);
        if (defaultNet) {
          this.props.updateContext?.({ network_id: defaultNet.id });
        }
      })
      .catch(err => console.error('네트워크 목록 조회 실패:', err));
  }

  handleNameChange = (e) => {
    const val = e.target.value;
    this.setState({ vmName: val });
    this.props.update?.({ name: val });
    this.props.updateContext?.({ name: val });
  };

  handleFlavorSelect = (key) => {
    this.setState({ selectedFlavorKey: key });
    const target = this.state.flavors.find(f => f.key === key);
    if (target) {
      this.props.update?.({ flavor: key, vcpus: target.vcpu, ram: parseInt(target.ram) });
      this.props.updateContext?.({ flavor: key, vcpus: target.vcpu, ram: parseInt(target.ram) });
    }
  };

  handleImageSelect = (key) => {
    this.setState({ selectedImageKey: key });
    this.props.update?.({ image: key });
    this.props.updateContext?.({ image: key });
  };

  render() {
    const { flavors, images, vmName, selectedFlavorKey, selectedImageKey } = this.state;

    return (
      <div style={{ width: '100%', padding: '24px' }}>
        <div style={{ maxWidth: '950px', margin: '0 auto' }}>
          
          {/* 1. 인스턴스 이름 * */}
          <div style={{ display: 'flex', marginBottom: 32, gap: 24 }}>
            <div style={labelStyle}>인스턴스 이름{requiredStar}</div>
            <div style={{ flex: 1, maxWidth: '800px' }}>
              <Input 
                placeholder="인스턴스 이름을 입력하세요" 
                value={vmName} 
                onChange={this.handleNameChange}
                style={{ width: '100%', height: '34px' }}
              />
            </div>
          </div>

          {/* 2. 인스턴스 유형 * */}
          <div style={{ display: 'flex', marginBottom: 32, gap: 24 }}>
            <div style={labelStyle}>인스턴스 유형{requiredStar}</div>
            <div style={{ flex: 1, maxWidth: '800px' }}>
              <Table
                dataSource={flavors} columns={flavorColumns} rowKey="key"
                pagination={false} size="small" bordered
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedFlavorKey ? [selectedFlavorKey] : [],
                  onChange: (keys) => this.handleFlavorSelect(keys[0]),
                }}
                onRow={(record) => ({
                  onClick: () => this.handleFlavorSelect(record.key),
                  style: { cursor: 'pointer', background: selectedFlavorKey === record.key ? '#e6f4ff' : '' }
                })}
              />
            </div>
          </div>

          {/* 3. OS 이미지 * */}
          <div style={{ display: 'flex', marginBottom: 32, gap: 24 }}>
            <div style={labelStyle}>OS 이미지{requiredStar}</div>
            <div style={{ flex: 1, maxWidth: '800px' }}>
              <Table
                dataSource={images} columns={imageColumns} rowKey="key"
                pagination={false} size="small" bordered
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedImageKey ? [selectedImageKey] : [],
                  onChange: (keys) => this.handleImageSelect(keys[0]),
                }}
                onRow={(record) => ({
                  onClick: () => this.handleImageSelect(record.key),
                  style: { cursor: 'pointer', background: selectedImageKey === record.key ? '#e6f4ff' : '' }
                })}
              />
            </div>
          </div>

        </div>
      </div>
    );
  }
}

export class OneClickCreate extends StepAction {
  static id = 'one-click-create';
  static title = '원클릭 생성'; 
  static path = (_, containerProps) => {
    const { detail, match } = containerProps || {};
      if (!detail || isEmpty(detail)) {
        return '/compute/instance/one-click-create';
      }
      if (match && match.path.indexOf('/compute/server') >= 0) {
        return `/compute/instance/one-click-create`;
      }
    };
  static policy = []; 
  static allowed() { return Promise.resolve(true); }

  get name() { return 'instance'; }

  init() {
    this.store = globalServerStore;
    this.projectStore = globalProjectStore;
    this.status = 'success';
  }

  get steps() {
    return [
      { 
        title: '원클릭 생성', 
        component: OneClickForm,
        props: {
          update: (newData) => {
            this.setState((prev) => ({
              data: { ...(prev.data || {}), ...newData }
            }));
          }
        }
      },
    ];
  }

  get listUrl() {
    return this.getRoutePath('instance');
  }

  onOk = () => {
    const { data } = this.state;

    if (!data.name || !data.name.trim()) {
      Notify.error('인스턴스 이름을 입력해 주세요.');
      return; 
    }

    if (!data.flavor) {
      Notify.error('인스턴스 유형을 선택해 주세요.');
      return;
    }

    if (!data.image) {
      Notify.error('OS 이미지를 선택해 주세요.');
      return;
    }

    if (!data.network_id) {
      Notify.error(`오픈스택에서 '${DEFAULT_NETWORK_NAME}' 네트워크를 찾을 수 없어 생성할 수 없습니다.`);
      return;
    }

    const body = {
      name: data.name.trim(),
      image: data.image,
      flavor: data.flavor,
      network_id: data.network_id,
    };

    fetch(`${API}/create-instance`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders() // 인증 토큰 헤더 추가
      },
      body: JSON.stringify(body),
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          this.routing.push(this.listUrl);
          Notify.success('인스턴스 원클릭 생성 요청 성공!');
        } else {
          Notify.error('인스턴스 생성 실패: ' + (result.detail || '알 수 없는 오류'));
        }
      })
      .catch(err => {
        console.error('생성 실패:', err);
        Notify.error('인스턴스 원클릭 생성에 실패했습니다.');
      });
  };
}

export default observer(inject('rootStore')(OneClickCreate));