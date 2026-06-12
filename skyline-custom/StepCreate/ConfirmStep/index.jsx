import React from 'react';
import Base from 'components/Form';
import { inject, observer } from 'mobx-react';

export class ConfirmStep extends Base {
  get title() { return 'Confirm Config'; }
  get name() { return 'Confirm Config'; }
  get isStep() { return true; }
  allowed = () => Promise.resolve();

  get formItems() {
    const { context } = this.props;
    return [
      {
        name: 'confirm-info',
        type: 'label',
        content: (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', background: '#1677ff', padding: '8px 16px', borderRadius: '4px 4px 0 0' }}>기본 설정</div>
              <div style={{ border: '1px solid #e0eaff', borderTop: 'none', padding: 16, borderRadius: '0 0 4px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Flavor</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{context?.flavor || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>OS 이미지</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{context?.image || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>시스템 디스크</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{context?.bootFromVolume ? `${context?.diskSize || 20} GiB` : '생성 안 함'}</span>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', background: '#1677ff', padding: '8px 16px', borderRadius: '4px 4px 0 0' }}>네트워크 구성</div>
              <div style={{ border: '1px solid #e0eaff', borderTop: 'none', padding: 16, borderRadius: '0 0 4px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>네트워크</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{Array.isArray(context?.network_ids) ? context.network_ids.join(', ') : context?.network_id || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>보안 그룹</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{Array.isArray(context?.security_groups) ? context.security_groups.join(', ') : context?.security_group || '-'}</span>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', background: '#1677ff', padding: '8px 16px', borderRadius: '4px 4px 0 0' }}>시스템 설정</div>
              <div style={{ border: '1px solid #e0eaff', borderTop: 'none', padding: 16, borderRadius: '0 0 4px 4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>인스턴스 이름</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{context?.name || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>키페어</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{context?.keypair || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        ),
      }
    ];
  }
}

export default inject('rootStore')(observer(ConfirmStep));