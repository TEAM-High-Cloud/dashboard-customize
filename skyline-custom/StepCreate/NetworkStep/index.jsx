import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Table, Tabs, message } from 'antd';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

const networkColumns = [
  { title: '이름', dataIndex: 'name' },
  { title: '외부', dataIndex: 'external', render: v => v ? '예' : '아니오' },
  { title: '공유', dataIndex: 'shared', render: v => v ? '예' : '아니오' },
  { title: '상태', dataIndex: 'status', render: v => (
    <span>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: v === 'ACTIVE' ? '#52c41a' : '#ff4d4f', marginRight: 6 }} />
      {v === 'ACTIVE' ? '사용 중' : '비활성'}
    </span>
  )},
];

const securityGroupColumns = [
  { title: '이름', dataIndex: 'name' },
  { title: '설명', dataIndex: 'description' },
];

const NetworkStep = forwardRef(function MyNetworkStep(props, ref) {
  const { updateContext } = props;

  const [networks, setNetworks] = useState([]);
  const [securityGroups, setSecurityGroups] = useState([]);
  const [selectedNetworkKeys, setSelectedNetworkKeys] = useState([]);
  const [selectedSecGroupKeys, setSelectedSecGroupKeys] = useState([]);
  const [netTab, setNetTab] = useState('project');

  useImperativeHandle(ref, () => ({
    validate: () => {
      if (!selectedNetworkKeys || selectedNetworkKeys.length === 0) {
        message.error('네트워크를 선택해 주세요.');
        return false;
      }
      if (!selectedSecGroupKeys || selectedSecGroupKeys.length === 0) {
        message.error('보안 그룹을 선택해 주세요.');
        return false;
      }
      return true;
    }
  }));

  useEffect(() => {
    axios.get(`${API}/networks`).then(res => setNetworks(res.data));
    axios.get(`${API}/security-groups`).then(res => setSecurityGroups(res.data));
  }, []);

  const handleNetworkSelect = (keys) => {
    setSelectedNetworkKeys(keys);
    updateContext?.({ network_ids: keys });
  };

  const handleSecGroupSelect = (keys) => {
    setSelectedSecGroupKeys(keys);
    updateContext?.({ security_groups: keys });
  };

  const getFilteredNetworks = () => {
    if (netTab === 'project') return networks.filter(n => !n.external);
    if (netTab === 'shared') return networks.filter(n => n.shared);
    if (netTab === 'external') return networks.filter(n => n.external);
    return networks;
  };

  const rowStyle = { display: 'flex', marginBottom: 36, gap: 32 };
  const labelStyle = { width: 160, fontSize: 14, fontWeight: 'bold', color: '#222', paddingTop: 4 };
  const contentStyle = { flex: 1 };
  const requiredStyle = <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>;

  return (
    <div style={{ width: '100%', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', padding: '16px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 48, maxWidth: '1150px', margin: '0 auto', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>

          <div style={rowStyle}>
            <div style={labelStyle}>
              <div>네트워크{requiredStyle}</div>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginTop: 6 }}>인스턴스가 연결될 네트워크를 선택하세요.</div>
            </div>
            <div style={contentStyle}>
              <Tabs activeKey={netTab} onChange={setNetTab} size="small" style={{ marginBottom: 12 }}>
                <Tabs.TabPane tab="현재 프로젝트 네트워크" key="project" />
                <Tabs.TabPane tab="공유 네트워크" key="shared" />
                <Tabs.TabPane tab="외부 네트워크" key="external" />
              </Tabs>
              <Table
                dataSource={getFilteredNetworks()} columns={networkColumns} rowKey="key"
                pagination={false} size="small" bordered
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedNetworkKeys,
                  onChange: (keys) => handleNetworkSelect(keys),
                }}
                onRow={(record) => ({
                  onClick: () => {
                    const newKeys = selectedNetworkKeys.includes(record.key)
                      ? selectedNetworkKeys.filter(k => k !== record.key)
                      : [...selectedNetworkKeys, record.key];
                    handleNetworkSelect(newKeys);
                  },
                  style: { cursor: 'pointer', background: selectedNetworkKeys.includes(record.key) ? '#e6f4ff' : '' }
                })}
              />
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStyle}>
              <div>보안 그룹{requiredStyle}</div>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginTop: 6 }}>방화벽 그룹을 선택하세요.</div>
            </div>
            <div style={contentStyle}>
              <Table
                dataSource={securityGroups} columns={securityGroupColumns} rowKey="key"
                pagination={false} size="small" bordered
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys: selectedSecGroupKeys,
                  onChange: (keys) => handleSecGroupSelect(keys),
                }}
                onRow={(record) => ({
                  onClick: () => {
                    const newKeys = selectedSecGroupKeys.includes(record.key)
                      ? selectedSecGroupKeys.filter(k => k !== record.key)
                      : [...selectedSecGroupKeys, record.key];
                    handleSecGroupSelect(newKeys);
                  },
                  style: { cursor: 'pointer', background: selectedSecGroupKeys.includes(record.key) ? '#e6f4ff' : '' }
                })}
              />
            </div>
          </div>

        </div>
        <div style={{ width: 160 }} />
      </div>
    </div>
  );
});

export default NetworkStep;