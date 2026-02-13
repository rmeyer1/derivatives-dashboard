'use client';

import { useState, useEffect } from 'react';
import { Position } from '@/types/position';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

interface EditPositionDialogProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: number, data: {
    currentPrice?: number;
    notes?: string;
    acknowledgmentFlag?: boolean;
    alertType?: string;
    managementPlan?: string;
  }) => Promise<void>;
}

export function EditPositionDialog({
  position,
  isOpen,
  onClose,
  onSubmit,
}: EditPositionDialogProps) {
  const [formData, setFormData] = useState({
    currentPrice: undefined as number | undefined,
    notes: '',
    acknowledgmentFlag: false,
    alertType: '',
    managementPlan: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && position) {
      setFormData({
        currentPrice: position.currentPrice || undefined,
        notes: position.notes || '',
        acknowledgmentFlag: position.acknowledgmentFlag || false,
        alertType: position.alertType || '',
        managementPlan: position.managementPlan || '',
      });
      setError(null);
    }
  }, [isOpen, position]);

  const calculatedPNL = position && formData.currentPrice !== undefined
    ? (position.entryCreditPerContract - formData.currentPrice) * position.contracts * 100
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position) return;

    setIsLoading(true);
    setError(null);

    try {
      const updateData: any = {};
      
      if (formData.currentPrice !== undefined && formData.currentPrice !== position.currentPrice) {
        updateData.currentPrice = formData.currentPrice;
      }
      
      if (formData.notes !== position.notes) {
        updateData.notes = formData.notes || null;
      }
      
      if (formData.acknowledgmentFlag !== position.acknowledgmentFlag) {
        updateData.acknowledgmentFlag = formData.acknowledgmentFlag;
      }
      
      if (formData.alertType !== (position.alertType || '')) {
        updateData.alertType = formData.alertType || null;
      }
      
      if (formData.managementPlan !== (position.managementPlan || '')) {
        updateData.managementPlan = formData.managementPlan || null;
      }

      if (Object.keys(updateData).length > 0) {
        await onSubmit(position.id, updateData);
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!position) return null;

  const isITM = position.itm;
  const entryCredit = position.entryCreditPerContract;
  const currentPrice = formData.currentPrice ?? position.currentPrice ?? entryCredit;
  const unrealizedPNL = entryCredit - currentPrice;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isITM ? (
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            Edit Position: {position.ticker}
            <span className="text-muted-foreground text-sm">
              $${position.shortStrike} {position.strategy}
            </span>
          </DialogTitle>
        </DialogHeader>

        {isITM && (
          <Alert variant="destructive" className="border-orange-200 bg-orange-50">
            <AlertDescription className="text-orange-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                This position is In-The-Money!
              </div>
              <div className="mt-1 text-sm">
                Stock price is {position.stockPrice ? `$${position.stockPrice.toFixed(2)}` : 'unknown'}
                {', '} strike is ${position.shortStrike.toFixed(2)}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPrice">Current Mark Price (per contract)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="currentPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder={entryCredit.toFixed(2)}
                value={formData.currentPrice ?? ''}
                onChange={(e) => handleChange('currentPrice', 
                  e.target.value ? parseFloat(e.target.value) : undefined
                )}
                disabled={isLoading}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Entry credit: ${entryCredit.toFixed(2)}
            </div>
          </div>

          {/* P&L Display */}
          {calculatedPNL !== null && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-muted-foreground">
                Unrealized P&L ({position.contracts} contract{position.contracts !== 1 ? 's' : ''})
              </div>
              <div className={`text-2xl font-bold ${calculatedPNL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {calculatedPNL >= 0 ? '+' : ''}
                ${calculatedPNL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-muted-foreground">
                ({((calculatedPNL / (entryCredit * position.contracts * 100)) * 100).toFixed(1)}% of max profit)
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="managementPlan">Management Plan</Label>
            <Input
              id="managementPlan"
              placeholder="e.g., Roll at 21 DTE, close at 50% profit..."
              value={formData.managementPlan}
              onChange={(e) => handleChange('managementPlan', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alertType">Alert Type</Label>
            <select
              id="alertType"
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              value={formData.alertType}
              onChange={(e) => handleChange('alertType', e.target.value)}
              disabled={isLoading}
            >
              <option value="">None</option>
              <option value="ITM">ITM (In-The-Money)</option>
              <option value="OTM">OTM (Out-of-The-Money)</option>
              <option value="Near Strike">Near Strike</option>
              <option value="Earnings">Earnings</option>
              <option value="Ex-Div">Ex-Dividend</option>
            </select>
          </div>

          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="acknowledgmentFlag"
              checked={formData.acknowledgmentFlag}
              onCheckedChange={(checked) => handleChange('acknowledgmentFlag', checked)}
              disabled={isLoading}
            />
            <div className="space-y-1">
              <Label htmlFor="acknowledgmentFlag" className="font-normal cursor-pointer">
                Acknowledge Alert
              </Label>
              <p className="text-xs text-muted-foreground">
                Mark this alert as acknowledged. This will remove it from the alert board.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
