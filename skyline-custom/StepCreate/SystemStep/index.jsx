import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Input, Table, message } from 'antd';
import axios from 'axios';

const API = 'http://192.168.10.10:8003';

const keypairColumns = [
  { title: '이름', dataIndex: 'name' },
];

const SystemStep = forwardRef(function MySystemStep(props, ref) {
  const { updateContext, context } = props;

  const [instanceName, setInstanceName] = useState(context?.name ?? '');
  const [nameError, setNameError] = useState(null);
  const [keypairs, setKeypairs] = useState([]);
  const [selectedKeypair, setSelectedKeypair] = useState(context?.keypair ?? null);

  const validateName = (value) => {
    if (!value) return '인스턴스 이름을 입력해 주세요.';
    if (!/^[a-zA-Z0-9]/.test(value)) return '영문자 또는 숫자로 시작해야 합니다.';
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) return '영문자, 숫자, -, _, . 만 사용 가능합니다.';
    if (value.length > 128) return '128자 이하로 입력해 주세요.';
    return null;
  };

  useImperativeHandle(ref, () => ({
    validate: () => {
      const err = validateName(instanceName);
      if (err) { message.error(err); return false; }
      if (!selectedKeypair) { message.error('키페어를 선택해 주세요.'); return false; }
      return true;
    }
  }));

  useEffect(() => {
    axios.get(`${API}/keypairs`).then(res => setKeypairs(res.data));
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setInstanceName(val);
    setNameError(validateName(val));
    updateContext?.({ name: val });
  };

  const handleKeypairSelect = (key) => {
    setSelectedKeypair(key);
    updateContext?.({ keypair: key });
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
              <div>인스턴스 이름{requiredStyle}</div>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginTop: 6 }}>영문자, 숫자, -, _, . 만 사용 가능합니다.</div>
            </div>
            <div style={contentStyle}>
              <Input
                placeholder="인스턴스 이름을 입력하세요"
                value={instanceName}
                onChange={handleNameChange}
                size="large"
                status={nameError ? 'error' : ''}
              />
              {nameError && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{nameError}</div>}
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStyle}>로그인 입력</div>
            <div style={contentStyle}>
              <button style={{
                padding: '6px 18px', borderRadius: 4, fontSize: 13,
                border: '2px solid #1677ff', background: '#e6f4ff',
                color: '#1677ff', cursor: 'default', fontWeight: 'bold',
              }}>키 페어</button>
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStyle}>
              <div>키 페어{requiredStyle}</div>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginTop: 6 }}>SSH 접속에 사용할 키페어를 선택하세요.</div>
            </div>
            <div style={contentStyle}>
              <Table
                dataSource={keypairs} columns={keypairColumns} rowKey="key"
                pagination={false} size="small" bordered
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedKeypair ? [selectedKeypair] : [],
                  onChange: (keys) => handleKeypairSelect(keys[0]),
                }}
                onRow={(record) => ({
                  onClick: () => handleKeypairSelect(record.key),
                  style: { cursor: 'pointer', background: selectedKeypair === record.key ? '#e6f4ff' : '' }
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

export default SystemStep;