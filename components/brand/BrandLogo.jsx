import Image from 'next/image';

export default function BrandLogo({ compact = false, className = '' }) {
  return (
    <span className={`relative block ${compact ? 'h-9 w-24' : 'h-12 w-36'} ${className}`}>
      <Image
        src="/brand/ireserve-logo.png"
        alt="iReserve"
        fill
        priority
        sizes={compact ? '96px' : '144px'}
        className="object-contain object-center"
      />
    </span>
  );
}
