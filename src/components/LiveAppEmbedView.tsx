import React, { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';

interface LiveAppEmbedViewProps {
  appId: 'jtd' | 'inasep' | 'sitesnap';
  title: string;
  url: string;
  onBackHome: () => void;
  onSwitchApp: (appId: 'jtd' | 'inasep' | 'sitesnap') => void;
}

export const LiveAppEmbedView: React.FC<LiveAppEmbedViewProps> = ({
  appId,
  title,
  url,
  onBackHome,
  onSwitchApp,
}) => {
  const [loaded, setLoaded] = useState(false);

  const tabs: { id: 'jtd' | 'inasep' | 'sitesnap'; label: string }[] = [
    { id: 'jtd', label: 'JTD' },
    { id: 'inasep', label: 'Project-Controler' },
    { id: 'sitesnap', label: 'Appli-Photo' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Accueil</span>
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setLoaded(false);
                  onSwitchApp(t.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  appId === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <span>Plein écran</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="relative flex-1 bg-slate-50">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 pointer-events-none">
            Chargement de {title}...
          </div>
        )}
        <iframe
          key={url}
          src={url}
          title={title}
          onLoad={() => setLoaded(true)}
          allow="camera; microphone; geolocation; clipboard-write"
          className="w-full h-full border-0 relative z-10 bg-white"
        />
      </div>
    </div>
  );
};
