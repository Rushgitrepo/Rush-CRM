import { Phone } from 'lucide-react';
import { useSoftphone } from '@/contexts/SoftphoneContext';
import { useTelephony } from '@/hooks/useTelephony';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClickToCallProps {
  phoneNumber: string;
  entityType?: 'lead' | 'deal' | 'contact' | 'company';
  entityId?: string;
  className?: string;
  showText?: boolean;
  showIcon?: boolean;
  variant?: 'link' | 'ghost' | 'outline';
}

export function ClickToCall({ 
  phoneNumber, 
  entityType, 
  entityId, 
  className = '', 
  showText = true, 
  showIcon = true,
  variant = 'link'
}: ClickToCallProps) {
  // Use optional chaining or defaults in case hooks are not fully initialized
  const telephony = useTelephony() || { canUseTelephony: false, hasProviders: false };
  const softphone = useSoftphone() || { dialNumber: () => {}, activeProvider: null, openSoftphone: () => {} };

  const { canUseTelephony, hasProviders } = telephony;
  const { dialNumber, activeProvider, openSoftphone } = softphone;

  if (!phoneNumber) return null;

  // Even if they can't use telephony or no providers yet, we want it to be CLICKABLE
  // so they can at least open the softphone or use system tel: link
  // Only show plain text if we TRULY have no way to call
  if (!canUseTelephony && !openSoftphone) {
    if (showText) return <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showIcon && <Phone className="h-3.5 w-3.5 opacity-50" />}
      {phoneNumber}
    </span>;
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[ClickToCall] Clicked:', { phoneNumber, activeProvider, hasProviders, canUseTelephony });

    if (activeProvider) {
      dialNumber(phoneNumber, entityType && entityId ? { entityType, entityId } : undefined);
    } else if (openSoftphone) {
      console.log('[ClickToCall] No active provider, opening softphone...');
      openSoftphone();
    } else {
      console.log('[ClickToCall] Softphone not available, falling back to tel:');
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  if (variant === 'ghost' || variant === 'outline') {
    return (
      <Button
        variant={variant}
        size="icon"
        className={cn("h-8 w-8", className)}
        onClick={handleClick}
        title={activeProvider ? `Call ${phoneNumber} via ${activeProvider}` : 'Open softphone to call'}
      >
        <Phone className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 cursor-pointer group transition-colors",
        "hover:text-primary",
        className
      )}
      onClick={handleClick}
      title={activeProvider ? `Call ${phoneNumber} via ${activeProvider}` : 'Open softphone to call'}
    >
      {showIcon && <Phone className="h-3.5 w-3.5 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />}
      {showText && (
        <span className="group-hover:underline transition-color font-medium">
          {phoneNumber}
        </span>
      )}
    </span>
  );
}

// Add a default export to prevent import errors in different parts of the app
export default ClickToCall;
