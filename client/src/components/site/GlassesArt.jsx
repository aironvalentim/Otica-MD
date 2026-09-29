// Ilustração vetorial de óculos por formato. Usada quando o produto ainda não tem foto.
const CORES = {
  preto: '#1f2937',
  'preto fosco': '#2b2f36',
  tartaruga: '#7a4a24',
  dourado: '#b9843c',
  prata: '#9ca3af',
  grafite: '#4b5563',
  azul: '#1d4ed8',
  vermelho: '#b91c1c',
  marrom: '#6b3f1d',
  rosa: '#db7093',
  transparente: '#c7c2b8',
};

function corDe(cor) {
  const c = String(cor || '').toLowerCase();
  const chave = Object.keys(CORES).find((k) => c.startsWith(k));
  return chave ? CORES[chave] : '#16202e';
}

function Lente({ formato, cx, cy, ...rest }) {
  switch (formato) {
    case 'redondo':
      return <circle cx={cx} cy={cy} r="26" {...rest} />;
    case 'oval':
      return <ellipse cx={cx} cy={cy} rx="31" ry="23" {...rest} />;
    case 'retangular':
      return <rect x={cx - 34} y={cy - 19} width="68" height="38" rx="8" {...rest} />;
    case 'hexagonal': {
      const pts = [0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return `${cx + 31 * Math.cos(r)},${cy + 27 * Math.sin(r)}`;
      });
      return <polygon points={pts.join(' ')} strokeLinejoin="round" {...rest} />;
    }
    case 'gatinho': {
      const s = cx < 100 ? -1 : 1;
      const d = `M ${cx - 32 * s} ${cy - 10} Q ${cx - 30 * s} ${cy + 24} ${cx} ${cy + 22} Q ${cx + 30 * s} ${cy + 20} ${cx + 32 * s} ${cy - 6}
                 Q ${cx + 38 * s} ${cy - 24} ${cx + 40 * s} ${cy - 26} Q ${cx} ${cy - 24} ${cx - 32 * s} ${cy - 10} Z`;
      return <path d={d} strokeLinejoin="round" {...rest} />;
    }
    case 'aviador': {
      const s = cx < 100 ? -1 : 1;
      const d = `M ${cx - 30 * s} ${cy - 18} Q ${cx} ${cy - 24} ${cx + 30 * s} ${cy - 16} Q ${cx + 32 * s} ${cy + 8} ${cx + 12 * s} ${cy + 26}
                 Q ${cx - 18 * s} ${cy + 30} ${cx - 30 * s} ${cy + 8} Z`;
      return <path d={d} strokeLinejoin="round" {...rest} />;
    }
    default:
      return <rect x={cx - 31} y={cy - 24} width="62" height="48" rx="14" {...rest} />;
  }
}

export default function GlassesArt({ formato, cor, solar = false, className = '' }) {
  const traco = corDe(cor);
  const lenteFill = solar ? 'rgba(22,32,46,0.78)' : 'rgba(255,255,255,0.35)';
  return (
    <svg viewBox="0 0 200 110" className={className} role="img" aria-label={`Óculos formato ${formato || 'clássico'}`}>
      <g fill={lenteFill} stroke={traco} strokeWidth="5">
        <Lente formato={formato} cx={62} cy={58} />
        <Lente formato={formato} cx={138} cy={58} />
      </g>
      <path d="M 93 54 Q 100 46 107 54" fill="none" stroke={traco} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 28 46 L 8 40" stroke={traco} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 172 46 L 192 40" stroke={traco} strokeWidth="4.5" strokeLinecap="round" />
      {!solar && <path d="M 44 44 L 54 38" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.7" />}
    </svg>
  );
}
