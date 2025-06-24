import React from 'react';

export type DeckSections = {
  main: string[];
  extra: string[];
  side: string[];
};

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

const UploadYDK: React.FC<UploadYDKProps> = ({ onDeckParsed }) => {
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
    <div>
      <input type="file" accept=".ydk" onChange={handleFile} />
    </div>
  );
};

export default UploadYDK; 