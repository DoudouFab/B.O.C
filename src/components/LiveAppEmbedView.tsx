import React, { useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';

interface LiveAppEmbedViewProps {
  appId: 'jtd' | 'inasep' | 'sitesnap';
  title: string;
  url: string;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  onBackHome: () => void;
  onSwitchApp: (appId: 'jtd' | 'inasep' | 'sitesnap') => void;
}

export const LiveAppEmbedView: React.FC<LiveAppEmbedViewProps> = ({
  appId,
  title,
  url,
  iframeRef,
  onBackHome,
  onSwitchApp,
}) => {
  const [loaded, setLoaded] = useState(false);

  const tabs: {
    id: 'jtd' | 'inasep' | 'sitesnap';
    label: string;
    iconSrc: string;
  }[] = [
    { id: 'jtd', label: 'JDT', iconSrc: 'app-icons/jdt-icon.svg' },
    {
      id: 'inasep',
      label: 'Project-Controler',
      iconSrc: 'app-icons/project-controler-icon.png',
    },
    {
      id: 'sitesnap',
      label: 'Appli-Photo',
      iconSrc: 'app-icons/appli-photo-icon.png',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="h-11 px-2.5 sm:px-4 border-b border-slate-200/90 flex items-center justify-between gap-2 bg-slate-50/95 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>B.O.C</span>
          </button>

          <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setLoaded(false);
                  onSwitchApp(t.id);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
                  appId === t.id
                    ? 'bg-gradient-to-r from-blue-700 to-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <img
                  src={t.iconSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-3.5 h-3.5 rounded-sm object-contain shrink-0 bg-white p-0.5"
                />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-700 to-sky-600 text-xs font-semibold text-white hover:from-blue-800 hover:to-sky-700 shadow-xs transition-all whitespace-nowrap shrink-0"
        >
          <span className="hidden sm:inline">Fenêtre seule</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="relative flex-1 min-h-0 bg-white">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 pointer-events-none">
            Chargement de {title}...
          </div>
        )}
        <iframe
          ref={iframeRef}
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
