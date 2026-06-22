import React, { forwardRef, useImperativeHandle } from 'react';

const ConfirmStep = forwardRef(function MyConfirmStep(props, ref) {
  const { context } = props;

  useImperativeHandle(ref, () => ({
  wrappedInstance: {
    checkFormInput: (callback) => {
      callback({});
    }
  },
  validate: () => true,
}));

  const Section = ({ title, rows }) => (
    <div style={{ marginBottom: 24, width: '80%' }}>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', background: '#1677ff', padding: '8px 16px', borderRadius: '4px 4px 0 0' }}>{title}</div>
      <div style={{ border: '1px solid #e0eaff', borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
        {rows.map(({ label, value }, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderBottom: i < rows.length - 1 ? '1px solid #f0f0f0' : 'none', background: '#fff' }}>
            <span style={{ color: '#888', fontSize: 13 }}>{label}</span>
            <span style={{ fontWeight: 500, fontSize: 13, color: '#222' }}>{value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ width: '100%', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', padding: '16px 24px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <Section title="기본 설정" rows={[
          { label: 'Flavor', value: context?.flavor_name || context?.flavor },
          { label: 'OS 이미지', value: context?.image_name || context?.image },
          { label: '시스템 디스크', value: context?.bootFromVolume ? `${context?.diskSize || 20} GiB` : '생성 안 함' },
        ]} />
        <Section title="네트워크 구성" rows={[
          { label: '네트워크', value: context?.network_names?.join(', ') || context?.network_ids?.join(', ') },
          { label: '보안 그룹', value: context?.security_group_names?.join(', ') || context?.security_groups?.join(', ') },
        ]} />
        <Section title="시스템 설정" rows={[
          { label: '인스턴스 이름', value: context?.name },
          { label: '로그인 방식', value: context?.loginMode === 'keypair' ? '키 페어' : '암호' },
          context?.loginMode === 'keypair'
            ? { label: '키페어', value: context?.keypair }
            : { label: '로그인 이름', value: context?.login_user },
        ]} />
      </div>
    </div>
  );
});

export default ConfirmStep;