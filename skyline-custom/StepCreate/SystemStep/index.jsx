import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Input, Table, message } from 'antd';
import axios from 'axios';
import globalRootStore from 'stores/root';

const API = 'http://192.168.10.10:8003';

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

const keypairColumns = [
  { title: '이름', dataIndex: 'name' },
];

const SystemStep = forwardRef(function MySystemStep(props, ref) {
  const { updateContext, context } = props;

  const [instanceName, setInstanceName] = useState(context?.name ?? '');
  const [nameError, setNameError] = useState(null);
  const [loginMode, setLoginMode] = useState(context?.loginMode ?? 'password');
  const [loginUser, setLoginUser] = useState(context?.login_user ?? '');
  const [loginPassword, setLoginPassword] = useState(context?.login_password ?? '');
  const [loginPasswordConfirm, setLoginPasswordConfirm] = useState(context?.login_password ?? '');
  const [passwordError, setPasswordError] = useState(null);
  const [keypairs, setKeypairs] = useState([]);
  const [selectedKeypair, setSelectedKeypair] = useState(context?.keypair ?? null);

  const validateName = (value) => {
    if (!value) return '인스턴스 이름을 입력해 주세요.';
    if (!/^[a-zA-Z0-9]/.test(value)) return '영문자 또는 숫자로 시작해야 합니다.';
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) return '영문자, 숫자, -, _, . 만 사용 가능합니다.';
    if (value.length > 128) return '128자 이하로 입력해 주세요.';
    return null;
  };

  const validatePassword = (value) => {
    if (!value) return '비밀번호를 입력해 주세요.';
    if (value.length < 8) return '8자 이상 입력해 주세요.';
    if (!/[a-zA-Z]/.test(value)) return '영문자를 포함해야 합니다.';
    if (!/[0-9]/.test(value)) return '숫자를 포함해야 합니다.';
    return null;
  };

  useImperativeHandle(ref, () => ({
    wrappedInstance: {
      checkFormInput: (callback) => {
        const err = validateName(instanceName);
        if (err) { message.error(err); return; }
        if (loginMode === 'password') {
          if (!loginUser) { message.error('로그인 이름을 입력해 주세요.'); return; }
          const pwErr = validatePassword(loginPassword);
          if (pwErr) { message.error(pwErr); return; }
          if (loginPassword !== loginPasswordConfirm) { message.error('비밀번호가 일치하지 않습니다.'); return; }
        } else {
          if (!selectedKeypair) { message.error('키페어를 선택해 주세요.'); return; }
        }
        callback({
          name: instanceName,
          loginMode,
          login_user: loginUser,
          login_password: loginPassword,
          keypair: selectedKeypair,
        });
      }
    },
    validate: () => {
      const err = validateName(instanceName);
      if (err) { message.error(err); return false; }
      if (loginMode === 'password') {
        if (!loginUser) { message.error('로그인 이름을 입력해 주세요.'); return false; }
        const pwErr = validatePassword(loginPassword);
        if (pwErr) { message.error(pwErr); return false; }
        if (loginPassword !== loginPasswordConfirm) { message.error('비밀번호가 일치하지 않습니다.'); return false; }
      } else {
        if (!selectedKeypair) { message.error('키페어를 선택해 주세요.'); return false; }
      }
      return true;
    }
  }));

  useEffect(() => {
    axios.get(`${API}/keypairs`, { headers: getAuthHeaders() }).then(res => setKeypairs(res.data));
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setInstanceName(val);
    setNameError(validateName(val));
    updateContext?.({ name: val });
  };

  const handleLoginModeChange = (mode) => {
    setLoginMode(mode);
    updateContext?.({ loginMode: mode });
  };

  const handleLoginUserChange = (e) => {
    setLoginUser(e.target.value);
    updateContext?.({ login_user: e.target.value });
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setLoginPassword(val);
    const pwErr = validatePassword(val);
    setPasswordError(val !== loginPasswordConfirm ? '비밀번호가 일치하지 않습니다.' : null);
    updateContext?.({ login_password: val });
  };

  const handlePasswordConfirmChange = (e) => {
    const val = e.target.value;
    setLoginPasswordConfirm(val);
    setPasswordError(val !== loginPassword ? '비밀번호가 일치하지 않습니다.' : null);
  };

  const handleKeypairSelect = (key) => {
    setSelectedKeypair(key);
    updateContext?.({ keypair: key });
  };

  const rowStyle = { display: 'flex', marginBottom: 36, gap: 32 };
  const labelStyle = { width: 160, fontSize: 14, fontWeight: 'bold', color: '#222', paddingTop: 4 };
  const contentStyle = { flex: 1 };
  const requiredStyle = <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>;

  const modeBtn = (mode, label) => (
    <button
      key={mode}
      onClick={() => handleLoginModeChange(mode)}
      style={{
        padding: '6px 18px', borderRadius: 4, fontSize: 13,
        border: loginMode === mode ? '2px solid #1677ff' : '1px solid #d9d9d9',
        background: loginMode === mode ? '#e6f4ff' : '#fff',
        color: loginMode === mode ? '#1677ff' : '#333',
        cursor: 'pointer', fontWeight: loginMode === mode ? 'bold' : 'normal',
        marginRight: 8,
      }}
    >{label}</button>
  );

  return (
    <div style={{ width: '100%', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', padding: '16px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 48, maxWidth: '1150px', margin: '0 auto', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>

          {/* 인스턴스 이름 */}
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

          {/* 로그인 입력 방식 선택 */}
          <div style={rowStyle}>
            <div style={labelStyle}>로그인 입력{requiredStyle}</div>
            <div style={contentStyle}>
              <div>
                {modeBtn('password', '암호')}
                {modeBtn('keypair', '키 페어')}
              </div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                {loginMode === 'password'
                  ? '콘솔 및 SSH 비밀번호 접속에 사용됩니다.'
                  : 'SSH 키 기반 접속에 사용됩니다. 콘솔 로그인은 불가합니다.'}
              </div>
            </div>
          </div>

          {/* 암호 모드 */}
          {loginMode === 'password' && (
            <>
              <div style={rowStyle}>
                <div style={labelStyle}>
                  <div>로그인 이름{requiredStyle}</div>
                  <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginTop: 6 }}>콘솔 접속 시 사용할 계정명입니다.</div>
                </div>
                <div style={contentStyle}>
                  <Input
                    placeholder="예: ubuntu, centos"
                    value={loginUser}
                    onChange={handleLoginUserChange}
                    size="large"
                  />
                </div>
              </div>

              <div style={rowStyle}>
                <div style={labelStyle}>
                  <div>로그인 비밀번호{requiredStyle}</div>
                  <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginTop: 6 }}>8자 이상, 영문+숫자 조합</div>
                </div>
                <div style={contentStyle}>
                  <Input.Password
                    placeholder="비밀번호를 입력하세요"
                    value={loginPassword}
                    onChange={handlePasswordChange}
                    size="large"
                    status={passwordError ? 'error' : ''}
                  />
                  {passwordError && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{passwordError}</div>}
                </div>
              </div>

              <div style={rowStyle}>
                <div style={labelStyle}>
                  <div>비밀번호 확인{requiredStyle}</div>
                </div>
                <div style={contentStyle}>
                  <Input.Password
                    placeholder="비밀번호를 다시 입력하세요"
                    value={loginPasswordConfirm}
                    onChange={handlePasswordConfirmChange}
                    size="large"
                    status={passwordError ? 'error' : ''}
                  />
                  {passwordError && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{passwordError}</div>}
                </div>
              </div>
            </>
          )}

          {/* 키페어 모드 */}
          {loginMode === 'keypair' && (
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
          )}

        </div>
        <div style={{ width: 160 }} />
      </div>
    </div>
  );
});

export default SystemStep;