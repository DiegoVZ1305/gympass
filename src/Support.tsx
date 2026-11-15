import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import { Modal } from './ui';
import './styles/support.css';

export const supportContacts = [
  { name: 'Diego Vargas', phone: '59162629717', display: '+591 62629717' },
  { name: 'Mateo Bazoberry', phone: '59176738942', display: '+591 76738942' },
] as const;

export function supportWhatsappUrl(phone: string, version = '') {
  const text = `Hola, necesito ayuda con GymPASS${version ? ` ${version}` : ''}. Tengo un problema con la aplicación.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function WhatsAppIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8a8.5 8.5 0 1 1 16.2-4Z" />
    <path d="m8.2 7.5 1.5 2.3-.9 1.1a10.1 10.1 0 0 0 4.3 4.3l1.1-.9 2.3 1.5c-.4 1.4-1.5 1.7-2.6 1.3a12 12 0 0 1-7-7c-.4-1.1-.1-2.2 1.3-2.6Z" />
  </svg>;
}

export default function Support({ version = '' }: { version?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="icon-btn support-trigger" aria-label="Soporte por WhatsApp" title="Soporte por WhatsApp"
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <WhatsAppIcon /><span>WhatsApp</span>
    </button>
    {open && createPortal(<Modal title="Soporte por WhatsApp" className="support-dialog" onClose={() => setOpen(false)}>
      <p>¿Encontraste un error o necesitas ayuda? Elige un contacto para abrir su chat.</p>
      <div className="support-contacts">
        {supportContacts.map(contact => <a key={contact.phone} className="support-contact"
          href={supportWhatsappUrl(contact.phone, version)} target="_blank" rel="noopener noreferrer"
          aria-label={`Escribir a ${contact.name} por WhatsApp`}>
          <WhatsAppIcon />
          <span><strong>{contact.name}</strong><small>{contact.display}</small></span>
          <ExternalLink size={17} aria-hidden="true" />
        </a>)}
      </div>
    </Modal>, document.body)}
  </>;
}
