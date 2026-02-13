'use client';

import { useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

interface ClosePositionDialogProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: number, closeDebitPerContract: number, closeDate?: string) => Promise<void>;
}

export function ClosePositionDialog({
  position,
  isOpen,
  onClose,
  onSubmit,
}: ClosePositionDialogProps) {
  const [closeDebit, setCloseDebit] = useState<string>('');
  const [closeDate, setCloseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const resetForm = () => {
    setCloseDebit('');
    setCloseDate(new Date().toISOString().split('T')[0]);
    setError(null);
  };

  if (isOpen && position) {
    // Check if we need to reset form
    if (!closeDebit) {
      // Pre-fill with current mark price if available
      setCloseDebit(position.currentPrice?.toString() || '');
    }
  }

  const closeDebitValue = parseFloat(closeDebit) || 0;
  const entryCredit = position?.entryCreditPerContract || 0;
  const contracts = position?.contracts || 0;
  
  // Realized P&L calculation
  const realizedPNL = position
    ? (entryCredit - closeDebitValue) * contracts * 100
    : 0;
  
  const realizedPNLPercent = entryCredit > 0 
    ? ((entryCredit - closeDebitValue) / entryCredit) * 100
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validation
      if (!closeDebit || isNaN(closeDebitValue) || closeDebitValue < 0) {
        throw new Error('Please enter a valid close debit amount');
      }
      
      if (!closeDate) {
        throw new Error('Please select a close date');
      }

      await onSubmit(position.id, closeDebitValue, closeDate);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!position) return null;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Close Position: {position.ticker}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted p-3 rounded-lg mb-4">
          <div className="text-sm text-muted-foreground">Current Position</div>
          <div className="font-medium">
            {position.strategy} | Strike: ${position.shortStrike.toFixed(2)} | 
            {position.contracts} contract{position.contracts !== 1 ? 's' : ''}
          </div>
          <div className="text-sm">
            Entry Credit: ${entryCredit.toFixed(2)} per contract
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="closeDebit">
              Close Debit per Contract
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="closeDebit"
                type="number"
                step="0.01"
                min="0"
                placeholder="1.00"
                value={closeDebit}
                onChange={(e) => setCloseDebit(e.target.value)}
                disabled={isLoading}
                required
                className="pl-10"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The price you paid to close each contract
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closeDate">Close Date</Label>
            <Input
              id="closeDate"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {/* Realized P&L Preview */}
          <div className={`p-4 rounded-lg border-2 ${
            realizedPNL >= 0 
              ? 'border-green-200 bg-green-50' 
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {realizedPNL >= 0 ? (
                <>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Profit</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Loss</span>
                </>
              )}
            </div>
            
            <div className="text-2xl font-bold">
              <span className={realizedPNL >= 0 ? 'text-green-700' : 'text-red-700'}>
                {realizedPNL >= 0 ? '+' : ''}
                ${realizedPNL.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            
            <div className="text-sm mt-1">
              <span className={realizedPNLPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                ({realizedPNLPercent.toFixed(1)}% return on premium)
              </span>
              <span className="text-muted-foreground">
                {' '}| Max profit was ${(entryCredit * contracts * 100).toLocaleString()}
              </span>
            </div>
          </div>

          {closeDebitValue > entryCredit && (
            <Alert variant="destructive" className="border-orange-200 bg-orange-50">
              <AlertDescription className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-orange-600" />
                <div>
                  <div className="font-medium text-orange-800">This will result in a loss</div>
                  <div className="text-sm text-orange-700">
                    Close debit (${closeDebitValue.toFixed(2)}) exceeds entry credit (${entryCredit.toFixed(2)})
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                resetForm();
                onClose();
              }} 
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !closeDebit}
              variant={realizedPNL < 0 ? 'destructive' : 'default'}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Close
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
