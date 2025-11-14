import React from 'react';
import { useSettings, formatCurrency } from '@/components/utils';

export default function CurrencyDisplay({ amount, className = "" }) {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';
  
  return (
    <span className={className}>
      {formatCurrency(amount, currency)}
    </span>
  );
}