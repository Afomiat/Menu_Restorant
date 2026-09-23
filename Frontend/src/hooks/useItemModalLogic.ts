import { useState, useEffect, useMemo } from 'react';
import type { MenuItem } from '../types';

export interface UseItemModalLogicProps {
  item: MenuItem | null;
}

export function useItemModalLogic({ item }: UseItemModalLogicProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0].name : '');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [item]);

  const variantAdjustment = useMemo(() => {
    if (!item?.variants || !selectedVariant) return 0;
    return item.variants.find((v) => v.name === selectedVariant)?.priceAdjustment || 0;
  }, [item, selectedVariant]);

  const unitPrice = (item?.price || 0) + variantAdjustment;
  const totalPrice = unitPrice * quantity;

  const incrementQuantity = () => setQuantity((q) => q + 1);
  const decrementQuantity = () => setQuantity((q) => Math.max(1, q - 1));

  return {
    quantity,
    setQuantity,
    incrementQuantity,
    decrementQuantity,
    selectedVariant,
    setSelectedVariant,
    variantAdjustment,
    unitPrice,
    totalPrice,
  };
}
