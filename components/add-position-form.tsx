'use client';

import { useState, useEffect } from 'react';
import { Strategy, CreatePositionRequest } from '@/types/position';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface AddPositionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePositionRequest) => Promise<void>;
}

const strategies: Strategy[] = [
  'Cash Secured Put',
  'Covered Call',
  'Bull Put Spread',
  'Call Credit Spread',
  'Put Credit Spread',
  'Call Debit Spread',
  'Put Debit Spread',
  'Iron Condor',
  'Custom',
];

export function AddPositionForm({ isOpen, onClose, onSubmit }: AddPositionFormProps) {
  const [formData, setFormData] = useState<CreatePositionRequest>({
    ticker: '',
    strategy: 'Cash Secured Put',
    contracts: 1,
    shortStrike: 0,
    entryCreditPerContract: 0,
    expirationDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLongStrike = formData.strategy.includes('Spread') || formData.strategy === 'Iron Condor';
  const collateral = calculateCollateral();
  const maxProfit = (formData.entryCreditPerContract || 0) * (formData.contracts || 0) * 100;

  useEffect(() => {
    if (!isOpen) {
      // Reset form when closed
      setFormData({
        ticker: '',
        strategy: 'Cash Secured Put',
        contracts: 1,
        shortStrike: 0,
        entryCreditPerContract: 0,
        expirationDate: '',
      });
      setError(null);
    }
  }, [isOpen]);

  function calculateCollateral(): number {
    const { strategy, shortStrike, contracts, longStrike } = formData;
    
    if (strategy === 'Cash Secured Put') {
      return (shortStrike || 0) * (contracts || 0) * 100;
    } else if (strategy === 'Covered Call') {
      return 0;
    } else if (strategy.includes('Spread') || strategy === 'Iron Condor') {
      if (longStrike) {
        return Math.abs((shortStrike || 0) - longStrike) * (contracts || 0) * 100;
      }
      return (shortStrike || 0) * (contracts || 0) * 100;
    }
    return (shortStrike || 0) * (contracts || 0) * 100;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validation
      if (!formData.ticker.trim()) {
        throw new Error('Ticker is required');
      }
      
      if (!formData.expirationDate) {
        throw new Error('Expiration date is required');
      }
      
      const expDate = new Date(formData.expirationDate);
      if (isNaN(expDate.getTime())) {
        throw new Error('Invalid expiration date');
      }
      
      if (expDate <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      
      if ((formData.contracts || 0) <= 0) {
        throw new Error('Contracts must be greater than 0');
      }
      
      if ((formData.shortStrike || 0) <= 0) {
        throw new Error('Short strike must be greater than 0');
      }
      
      if (needsLongStrike && !formData.longStrike) {
        throw new Error('Long strike is required for spreads');
      }
      
      if (formData.longStrike && formData.shortStrike) {
        const width = Math.abs(formData.shortStrike - formData.longStrike);
        if (width < 1) {
          throw new Error('Strike width must be at least $1');
        }
      }
      
      if ((formData.entryCreditPerContract || 0) < 0) {
        throw new Error('Entry credit cannot be negative');
      }

      // Convert ticker to uppercase
      const submissionData = {
        ...formData,
        ticker: formData.ticker.toUpperCase(),
      };

      await onSubmit(submissionData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CreatePositionRequest, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Add New Position
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker</Label>
              <Input
                id="ticker"
                placeholder="AAPL"
                value={formData.ticker}
                onChange={(e) => handleChange('ticker', e.target.value)}
                disabled={isLoading}
                className="uppercase"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contracts">Contracts</Label>
              <Input
                id="contracts"
                type="number"
                min="1"
                value={formData.contracts}
                onChange={(e) => handleChange('contracts', parseInt(e.target.value) || 0)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategy">Strategy</Label>
            <Select
              value={formData.strategy}
              onValueChange={(value) => handleChange('strategy', value)}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shortStrike">Short Strike</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="shortStrike"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="100.00"
                  value={formData.shortStrike || ''}
                  onChange={(e) => handleChange('shortStrike', parseFloat(e.target.value) || 0)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expirationDate">
                <Calendar className="inline h-4 w-4 mr-1" />
                Expiration
              </Label>
              <Input
                id="expirationDate"
                type="date"
                value={formData.expirationDate}
                onChange={(e) => handleChange('expirationDate', e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {needsLongStrike && (
            <div className="space-y-2">
              <Label htmlFor="longStrike">Long Strike (for spreads)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="longStrike"
                  type="number"
                  step="0.01"
                  placeholder="95.00"
                  value={formData.longStrike || ''}
                  onChange={(e) => handleChange('longStrike', parseFloat(e.target.value) || undefined)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="entryCreditPerContract">
              Credit per Contract
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="entryCreditPerContract"
                type="number"
                step="0.01"
                min="0"
                placeholder="1.50"
                value={formData.entryCreditPerContract || ''}
                onChange={(e) => handleChange('entryCreditPerContract', parseFloat(e.target.value) || 0)}
                disabled={isLoading}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Entry rationale, management plan..."
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Collateral Required</div>
              <div className="text-lg font-semibold">
                {collateral > 0 ? `$${collateral.toLocaleString()}` : 'Stock'}
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">Max Profit</div>
              <div className="text-lg font-semibold text-green-600">
                +${maxProfit.toLocaleString()}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Position
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
