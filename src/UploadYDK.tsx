import React from 'react';

export type DeckSections = {
  main: string[];
  extra: string[];
  side: string[];
};

// Parse a YDK file into deck sections
function parseYDK(content: string): DeckSections {
  const sections: DeckSections = { main: [], extra: [], side: [] };
  let current = '';
  content.split(/\r?\n/).forEach(line => {
    if (line.startsWith('#main')) current = 'main';
    else if (line.startsWith('#extra')) current = 'extra';
    else if (line.startsWith('!side')) current = 'side';
    else if (!line.startsWith('#') && line.trim() && current) (sections as any)[current].push(line.trim());
  });
  return sections;
}

interface UploadYDKProps {
  onDeckParsed: (deck: DeckSections) => void;
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid #888',
  background: '#23234a',
  color: '#fff',
  fontSize: 15,
  margin: 0,
  outline: 'none',
  transition: 'border 0.2s, box-shadow 0.2s',
  boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
  cursor: 'pointer',
};
const containerStyle: React.CSSProperties = {
  display: 'block',
  padding: 0,
  marginBottom: 12,
  marginTop: 0,
  width: '100%',
};

const UploadYDK: React.FC<UploadYDKProps> = ({ onDeckParsed }) => {
  // Handle file upload and parse
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onDeckParsed(parseYDK(text));
    };
    reader.readAsText(file);
  };

  return (
    <div style={containerStyle}>
      <label style={{ color: '#fff', fontWeight: 600, marginBottom: 4, fontSize: 14, display: 'block', textAlign: 'center' }}>Upload YDK Deck File</label>
      <input
        type="file"
        accept=".ydk"
        onChange={handleFile}
        style={{ ...inputStyle, fontSize: 14, padding: '7px 0', width: '100%', display: 'block' }}
        onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 8px #2a7a3a')}
        onMouseOut={e => (e.currentTarget.style.boxShadow = inputStyle.boxShadow as string)}
      />
      <hr style={{ border: 'none', borderTop: '1px solid rgba(200,200,220,0.13)', margin: '10px 0 0 0' }} />
    </div>
  );
};

export default UploadYDK; 