import React from 'react';
import { inject, observer } from 'mobx-react';
import { toJS } from 'mobx';
import { InputNumber, Badge, message as $message } from 'antd';
import { StepAction } from 'containers/Action';
import globalServerStore from 'stores/nova/instance';
import globalProjectStore from 'stores/keystone/project';
import classnames from 'classnames';
import { isEmpty, isFinite, isString } from 'lodash';
import { getUserData, hashPasswordForCloudInit } from 'resources/nova/instance';
import { getAllDataDisks } from 'resources/cinder/snapshot';
import { getGiBValue } from 'utils/index';
import Notify from 'components/Notify';
import ConfirmStep from './ConfirmStep';
import SystemStep from './SystemStep';
import NetworkStep from './NetworkStep';
import BaseStep from './BaseStep';
import styles from './index.less';
import globalRootStore from 'stores/root';

export class StepCreate extends StepAction {
  static id = 'instance-create';
  static title = t('Create Instance');

  static path = (_, containerProps) => {
    const { detail, match } = containerProps || {};
    if (!detail || isEmpty(detail)) {
      return '/compute/instance/create';
    }
    if (match.path.indexOf('/compute/server') >= 0) {
      return `/compute/instance/create?servergroup=${detail.id}`;
    }
  };

  init() {
    this.store = globalServerStore;
    this.projectStore = globalProjectStore;
    this.state.quotaLoading = true;
    this.getQuota();
    this.status = 'success';
    this.errorMsg = '';
  }

  static policy = [
    'os_compute_api:servers:create',
    'os_compute_api:os-availability-zone:list',
  ];

  static allowed(_, containerProps) {
    const { isAdminPage = false } = containerProps;
    return Promise.resolve(!isAdminPage);
  }

  async getQuota() {
    this.setState({ quotaLoading: true });
    await Promise.all([
      this.projectStore.fetchProjectNovaQuota(),
      this.enableCinder ? this.projectStore.fetchProjectCinderQuota() : null,
    ]);
    this.setState({ quotaLoading: false });
    this.onCountChange(1);
  }

  get disableNext() { return !!this.errorMsg; }
  get disableSubmit() { return !!this.errorMsg; }

  get instanceQuota() {
    const { instances: { left = 0 } = {} } = toJS(this.projectStore.novaQuota) || {};
    return left === -1 ? Infinity : left;
  }

  get name() { return t('Create instance'); }

  get enableCinder() {
    return this.props.rootStore.checkEndpoint('cinder');
  }

  get listUrl() {
    const { image, volume, servergroup } = this.locationParams;
    if (image) return this.getRoutePath('image');
    if (volume) return this.getRoutePath('volume');
    if (servergroup) return this.getRoutePath('serverGroupDetail', { id: servergroup });
    return this.getRoutePath('instance');
  }

  get hasConfirmStep() { return false; }

  next() {
    const currentRef = this.currentRef?.current;
    if (currentRef) {
      const instance = currentRef.wrappedInstance || currentRef;
      if (instance?.validate) {
        const isValid = instance.validate();
        if (!isValid) return;
      }
    }
    this.setState((prev) => ({ current: prev.current + 1 }));
  }

  prev() {
    this.setState((prev) => ({ current: prev.current - 1 }));
  }

  get steps() {
    return [
      { title: t('Base Config'), component: BaseStep },
      { title: t('Network Config'), component: NetworkStep },
      { title: t('System Config'), component: SystemStep },
      { title: t('Confirm Config'), component: ConfirmStep },
    ];
  }

  get instanceName() {
    const { name, count = 1 } = this.values || {};
    if (count === 1) return this.unescape(name);
    return this.unescape(
      new Array(count).fill(count).map((_, i) => `${name}-${i + 1}`).join(', ')
    );
  }

  get successText() {
    return t(
      'The creation instruction was issued successfully, instance: {name}.',
      { action: this.name.toLowerCase(), name: this.instanceName }
    );
  }

  get showQuota() { return false; }

  onCountChange = (value) => {
    const { data } = this.state;
    this.setState({ data: { ...data, count: value } });
  };

  get errorText() {
    return t('The creation instruction has been issued, please refresh to see the actual situation in the list.');
  }

  renderFooterLeft() {
    const { data } = this.state;
    const { count = 1 } = data || {};
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span>{t('Count')}</span>
        <InputNumber
          min={1}
          max={100}
          precision={0}
          value={count}
          onChange={this.onCountChange}
          className={classnames(styles.input, 'instance-count')}
        />
      </div>
    );
  }

  onOk = () => {
    const { data } = this.state;

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

    const body = {
      name: data.name,
      image: data.image,
      flavor: data.flavor,
      network_id: data.network_ids?.[0] || data.network_id,
      network_ids: data.network_ids,
      security_group: data.security_groups?.[0] || data.security_group,
      security_groups: data.security_groups,
      keypair: data.keypair,
      login_mode: data.loginMode || 'password',
      login_user: data.login_user,
      login_password: data.login_password,
      volume_size: data.bootFromVolume ? data.diskSize : null,
    };

    const projectId = globalRootStore.projectId || '';  

    fetch('http://192.168.10.10:8003/create-instance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': cleanToken,
        'X-Project-Id': projectId,
      },
      body: JSON.stringify(body),
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          this.routing.push(this.listUrl);
          Notify.success(this.successText);
        }
      })
      .catch(err => {
        console.error('생성 실패:', err);
        Notify.error('인스턴스 생성에 실패했습니다.');
      });
  };
}

export default inject('rootStore')(observer(StepCreate));