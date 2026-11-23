import { BarChart3, Home, MoreHorizontal, ScanLine, ShoppingCart, Users } from 'lucide-react';
import type { Section, SectionId } from './navigation';

const primary = [
  ['dashboard', Home],
  ['access', ScanLine],
  ['people', Users],
  ['pos', ShoppingCart],
] as const satisfies readonly (readonly [SectionId, typeof BarChart3])[];
/** La barra del teléfono es estrecha: aquí la etiqueta va en una palabra para que no se parta en dos líneas. */
const shortLabels: Partial<Record<SectionId, string>> = { pos: 'Caja' };
export default function MobileNavigation({
  sections,
  current,
  more,
  onMore,
}: {
  sections: readonly Section[];
  current: SectionId;
  more: boolean;
  onMore: () => void;
}) {
  return (
    <nav className="mobile-navigation" aria-label="Navegación del teléfono">
      {primary.flatMap(([id, Icon]) => {
        const section = sections.find((item) => item.id === id);
        return section
          ? [
              <a
                key={id}
                href={section.href}
                aria-current={current === id && !more ? 'page' : undefined}
                aria-label={section.label}
              >
                <Icon size={22} aria-hidden="true" />
                <span>{shortLabels[id] ?? section.label}</span>
              </a>,
            ]
          : [];
      })}
      <button
        type="button"
        aria-expanded={more}
        aria-controls="main-navigation"
        onClick={onMore}
        className={more || !primary.some(([id]) => id === current) ? 'active' : ''}
      >
        <MoreHorizontal size={22} aria-hidden="true" />
        <span>Más</span>
      </button>
    </nav>
  );
}
