import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Table, Tabs, InputNumber, message } from 'antd';
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

const QuotaCard = ({ title, used, added, max }) => {
  const totalUsed = used + added;
  const pct = max > 0 ? Math.min(Math.round((totalUsed / max) * 100), 100) : 0;
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const getColor = (pct) => {
    if (pct >= 90) return '#ff4d4f';  // 빨강
    if (pct >= 70) return '#faad14';  // 노랑
    return '#52c41a';                  // 초록
  };
  return (
    <div style={{ background: '#f8faff', border: '1px solid #e0eaff', borderRadius: 14, padding: '20px 16px', textAlign: 'center', width: 160 }}>
      <div style={{ fontSize: 13, color: '#444', marginBottom: 12, fontWeight: 'bold' }}>{title}</div>
      <svg width="110" height="110" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e0eaff" strokeWidth="10" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={getColor(pct)} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 50 50)" strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s' }} />
        <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1677ff">{totalUsed}</text>
        <text x="50" y="66" textAnchor="middle" fontSize="12" fill="#888">/ {max}</text>
      </svg>
    </div>
  );
};

const BaseStep = forwardRef(function MyBaseStep(props, ref) {
  const { updateContext, context } = props;

  const [flavors, setFlavors] = useState([]);
  const [images, setImages] = useState([]);
  const [quota, setQuota] = useState(null);
  const [selectedFlavorKey, setSelectedFlavorKey] = useState(context?.flavor ?? null);
  const [selectedImageKey, setSelectedImageKey] = useState(context?.image ?? null);
  const [sourceTab, setSourceTab] = useState('image');
  const [bootFromVolume, setBootFromVolume] = useState(context?.bootFromVolume ?? true);
  const [diskSize, setDiskSize] = useState(context?.diskSize ?? 20);
  const [addedCores, setAddedCores] = useState(context?.vcpus ?? 0);
  const [addedRam, setAddedRam] = useState(context?.ram ?? 0);

  useImperativeHandle(ref, () => ({
  wrappedInstance: {
    checkFormInput: (callback) => {
      if (!selectedFlavorKey) {
        message.error('인스턴스 유형을 선택해 주세요.');
        return;
      }
      if (!selectedImageKey) {
        message.error('OS 이미지를 선택해 주세요.');
        return;
      }

      const selFlavor = flavors.find(f => f.key === selectedFlavorKey);
      const selImage = images.find(img => img.key === selectedImageKey);
      const isBfv = selFlavor?.disk === 0;
      const minDisk = isBfv
        ? Math.max(selImage?.min_disk ?? 0, 1)
        : Math.max(selFlavor?.disk ?? 0, selImage?.min_disk ?? 0, 1);
      
      if (bootFromVolume && diskSize < minDisk) {
        message.error(`디스크 크기는 최소 ${minDisk} GiB 이상이어야 합니다.`);
        return;
      }  

      if (quota) {
        const totalCores = quota.cores.used + addedCores;
        const totalRam = Math.round(quota.ram.used / 1024) + addedRam;
        if (totalCores > quota.cores.max) {
          message.error('CPU 할당량이 부족합니다.');
          return;
        }
        if (totalRam > Math.round(quota.ram.max / 1024)) {
          message.error('메모리 할당량이 부족합니다.');
          return;
        }

        if (bootFromVolume) {
          const volLeft = quota.volumes.max - quota.volumes.used;
          const volCapLeft = quota.volume_gb.max - quota.volume_gb.used;
          if (volLeft <= 0) { message.error('볼륨 할당량이 부족합니다.'); return; }
          if (volCapLeft < diskSize) { message.error('볼륨 용량 할당량이 부족합니다.'); return; }
        }
      }
      callback({
        flavor: selectedFlavorKey,
        image: selectedImageKey,
        bootFromVolume,
        diskSize,
        vcpus: addedCores,
        ram: addedRam,
      });
    },
    validate: () => {
    if (!selectedFlavorKey) { message.error('인스턴스 유형을 선택해 주세요.'); return false; }
    if (!selectedImageKey) { message.error('OS 이미지를 선택해 주세요.'); return false; }
    return true;
    }
  }
}));

  useEffect(() => {
    axios.get(`${API}/flavors`, { headers: getAuthHeaders() }).then(res => 
      setFlavors([
        ...res.data.filter(f => f.disk > 0),
        ...res.data.filter(f => f.disk === 0),
  ])
);
    axios.get(`${API}/images`, { headers: getAuthHeaders() }).then(res => setImages(res.data));
    axios.get(`${API}/quota`, { headers: getAuthHeaders() }).then(res => setQuota(res.data));
  }, []);

  const handleFlavorSelect = (key) => {
    setSelectedFlavorKey(key);
    const target = flavors.find(f => f.key === key);
    if (target) {
      setAddedCores(target.vcpu);
      setAddedRam(parseInt(target.ram));
      updateContext?.({
        flavor: key,
        flavor_name: target.label,
        vcpus: target.vcpu,
        ram: parseInt(target.ram),
        is_bfv: target.disk === 0,
      flavor_disk: target.disk,
      });
    }
  };

  const handleImageSelect = (key) => {
    setSelectedImageKey(key);
    const target = images.find(img => img.key === key);
    updateContext?.({
      image: key,
      image_name: target?.label ?? key,
      image_min_disk: target?.min_disk ?? 0,
    });
  };

  const rowStyle = { display: 'flex', marginBottom: 36, gap: 32 };
  const labelStyle = { width: 160, fontSize: 14, fontWeight: 'bold', color: '#222', paddingTop: 4 };
  const contentStyle = { flex: 1 };
  const requiredStyle = <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>;
  const selectedFlavor = flavors.find(f => f.key === selectedFlavorKey);
  const selectedImage = images.find(img => img.key === selectedImageKey);
  const isBfv = selectedFlavor?.disk === 0;
  const minDisk = isBfv
  ? Math.max(selectedImage?.min_disk ?? 0, 1)
  : Math.max(selectedFlavor?.disk ?? 0, selectedImage?.min_disk ?? 0, 1);


  return (
    <div style={{ width: '100%', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', padding: '16px 24px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 48, maxWidth: '1150px', margin: '0 auto', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>

          <div style={rowStyle}>
            <div style={labelStyle}>
              <div>인스턴스 유형{requiredStyle}</div>
              <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginTop: 6 }}>쿼터에 맞는 사양을 선택하세요.</div>
            </div>
            <div style={contentStyle}>
              <Table
                dataSource={flavors} columns={flavorColumns} rowKey="key"
                pagination={false} size="small" bordered
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedFlavorKey ? [selectedFlavorKey] : [],
                  onChange: (keys) => handleFlavorSelect(keys[0]),
                }}
                onRow={(record) => ({
                  onClick: () => handleFlavorSelect(record.key),
                  style: { cursor: 'pointer', background: selectedFlavorKey === record.key ? '#e6f4ff' : '' }
                })}
              />
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStyle}>OS 이미지{requiredStyle}</div>
            <div style={contentStyle}>
              <Tabs activeKey={sourceTab} onChange={setSourceTab} size="small" style={{ marginBottom: 12 }}>
                <Tabs.TabPane tab="이미지" key="image" />
                <Tabs.TabPane tab="인스턴스 스냅샷" key="snapshot" />
                <Tabs.TabPane tab="부팅가능 볼륨" key="volume" />
              </Tabs>
              {sourceTab === 'image' ? (
                <Table
                  dataSource={images} columns={imageColumns} rowKey="key"
                  pagination={false} size="small" bordered
                  rowSelection={{
                    type: 'radio',
                    selectedRowKeys: selectedImageKey ? [selectedImageKey] : [],
                    onChange: (keys) => handleImageSelect(keys[0]),
                  }}
                  onRow={(record) => ({
                    onClick: () => handleImageSelect(record.key),
                    style: { cursor: 'pointer', background: selectedImageKey === record.key ? '#e6f4ff' : '' }
                  })}
                />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#aaa', border: '1px dashed #ddd', borderRadius: 8 }}>데이터가 없습니다.</div>
              )}
            </div>
          </div>

          <div style={rowStyle}>
            <div style={labelStyle}>시스템 디스크{requiredStyle}</div>
            <div style={contentStyle}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[{ value: true, label: '생성' }, { value: false, label: '생성하지 않음' }].map(opt => (
                  <button key={String(opt.value)}
                    onClick={() => { setBootFromVolume(opt.value); updateContext?.({ bootFromVolume: opt.value }); }}
                    style={{
                      padding: '6px 18px', borderRadius: 4, fontSize: 12,
                      border: bootFromVolume === opt.value ? '2px solid #1677ff' : '1px solid #d9d9d9',
                      background: bootFromVolume === opt.value ? '#e6f4ff' : '#fff',
                      color: bootFromVolume === opt.value ? '#1677ff' : '#333',
                      cursor: 'pointer', fontWeight: bootFromVolume === opt.value ? 'bold' : 'normal',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
              {bootFromVolume && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f9f9f9', padding: '12px 16px', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: '#555' }}>디스크 크기:</span>
                  <InputNumber min={minDisk} max={500} value={diskSize} onChange={(val) => { setDiskSize(val); updateContext?.({ diskSize: val }); }} />
                  <span style={{ color: '#333' }}>GiB</span>
                  <span style={{ color: '#ff4d4f', fontSize: 11 }}>
                    {diskSize < minDisk ? `최소 ${minDisk} GiB 이상으로 설정해 주세요.` : ''}
                  </span>
                  <span style={{ color: '#999', fontSize: 11 }}>(VM 삭제 시 디스크도 함께 삭제됩니다)</span>
                </div>
              )}
            </div>
          </div>

        </div>

        <div style={{ width: 160, display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4 }}>
          {quota && (
            <>
              <QuotaCard title="CPU 할당량" used={quota.cores.used} added={addedCores} max={quota.cores.max} />
              <QuotaCard title="메모리 (GiB)" used={Math.round(quota.ram.used / 1024)} added={addedRam} max={Math.round(quota.ram.max / 1024)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default BaseStep;