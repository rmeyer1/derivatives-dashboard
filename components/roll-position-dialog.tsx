'use client';

import { useState } from 'react';
import { Position } from '@/types/position';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, RefreshCw, Calendar, ArrowRight } from 'lucide-react';

interface RollPositionDialogProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: number, data: {
    newShortStrike: number;
    newLongStrike?: number;
    newExpirationDate: string;
    newEntryCredit: number;
    newContracts?: number;
  }) => Promise<void>;
}

export function RollPositionDialog({
  position,
  isOpen,
  onClose,
  onSubmit,
}: RollPositionDialogProps) {
  const [formData, setFormData] = useState({
    newShortStrike: '',
    newLongStrike: '',
    newExpirationDate: '',
    newEntryCredit: '',
    newContracts: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      newShortStrike: '',
      newLongStrike: '',
      newExpirationDate: '',
      newEntryCredit: '',
      newContracts: '',
    });
    setError(null);
  };

  const needsLongStrike = position?.strategy.includes('Spread') || position?.strategy === 'Iron Condor';
  
  const newShortStrike = parseFloat(formData.newShortStrike) || 0;
  const newLongStrike = formData.newLongStrike ? parseFloat(formData.newLongStrike) : undefined;
  const newEntryCredit = parseFloat(formData.newEntryCredit) || 0;
  const newContracts = formData.newContracts ? parseInt(formData.newContracts) : position?.contracts;

  // Calculate new collateral
  const calculateCollateral = (): number => {
    if (!position) return 0;
    
    const contracts = newContracts || position.contracts;
    
    if (position.strategy === 'Cash Secured Put') {
      return newShortStrike * contracts * 100;
    } else if (position.strategy === 'Covered Call') {
      return 0;
    } else if (position.strategy.includes('Spread') || position.strategy === 'Iron Condor') {
      if (newLongStrike) {
        return Math.abs(newShortStrike - newLongStrike) * contracts * 100;
      }
      return newShortStrike * contracts * 100;
    }
    return newShortStrike * contracts * 100;
  };

  const newCollateral = calculateCollateral();
  const oldCollateral = position?.collateralRequired || 0;
  const collateralChange = newCollateral - oldCollateral;

  const newMaxProfit = newEntryCredit * (newContracts || position?.contracts || 1) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!position) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validation
      if (!formData.newShortStrike || newShortStrike <= 0) {
        throw new Error('Please enter a valid new short strike');
      }
      
      if (needsLongStrike && !formData.newLongStrike) {
        throw new Error('Long strike is required for spreads');
      }
      
      if (!formData.newExpirationDate) {
        throw new Error('Please select a new expiration date');
      }
      
      const expDate = new Date(formData.newExpirationDate);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
      
      if (needsLongStrike && newLongStrike) {
        const width = Math.abs(newShortStrike - newLongStrike);
        if (width < 1) {
          throw new Error('Strike width must be at least $1');
        }
      }
      
      if (newEntryCredit <= 0) {
        throw new Error('Please enter a valid credit amount');
      }

      await onSubmit(position.id, {
        newShortStrike,
        newLongStrike,
        newExpirationDate: formData.newExpirationDate,
        newEntryCredit,
        newContracts: formData.newContracts ? parseInt(formData.newContracts) : undefined,
      });
      
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            Roll Position: {position.ticker}
          </DialogTitle>
          <DialogDescription>
            Close the current position and open a new one with updated strikes/expiry
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted p-3 rounded-lg mb-4">
          <div className="text-sm text-muted-foreground mb-1">Current Position</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{position.ticker}</span>
            <span className="text-muted-foreground">|</span>
            <span>Strike: ${position.shortStrike.toFixed(2)}</span>
            {position.longStrike && (
              <>
                <span className="text-muted-foreground">/</span>
                <span>${position.longStrike.toFixed(2)}</span>
              </>
            )}
            <span className="text-muted-foreground">|</span>
            <span>{position.contracts} contract{position.contracts !== 1 ? 's' : ''}</span>
            <span className="text-muted-foreground">|</span>
            <span>Expires: {position.expirationDate}</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newShortStrike">New Short Strike</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newShortStrike"
                  type="number"
                  step="0.01"
                  placeholder={position.shortStrike.toString()}
                  value={formData.newShortStrike}
                  onChange={(e) => handleChange('newShortStrike', e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newExpirationDate">New Expiration</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newExpirationDate"
                  type="date"
                  value={formData.newExpirationDate}
                  onChange={(e) => handleChange('newExpirationDate', e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {needsLongStrike && (
            <div className="space-y-2">
              <Label htmlFor="newLongStrike">New Long Strike (for spread)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newLongStrike"
                  type="number"
                  step="0.01"
                  placeholder={position.longStrike?.toString() || ''}
                  value={formData.newLongStrike}
                  onChange={(e) => handleChange('newLongStrike', e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newEntryCredit">New Credit per Contract</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newEntryCredit"
                  type="number"
                  step="0.01"
                  placeholder="1.00"
                  value={formData.newEntryCredit}
                  onChange={(e) => handleChange('newEntryCredit', e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newContracts">Contracts (optional)</Label>
              <Input
                id="newContracts"
                type="number"
                min="1"
                placeholder={position.contracts.toString()}
                value={formData.newContracts}
                onChange={(e) => handleChange('newContracts', e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to keep {position.contracts} contracts
              </p>
            </div>
          </div>

          {/* New Position Preview */}
          {newShortStrike > 0 && newEntryCredit > 0 && (
            <div className="border-2 border-blue-200 bg-blue-50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2 font-medium text-blue-800">
                <ArrowRight className="h-4 w-4" />
                New Position Preview
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Collateral Required</div>
                  <div className="font-medium">
                    {newCollateral > 0 
                      ? `$${newCollateral.toLocaleString()}` 
                      : 'Stock (no cash)'}
                  </div>
                  {collateralChange !== 0 && (
                    <div className={`text-xs ${
                      collateralChange > 0 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {collateralChange > 0 ? '+' : ''}
                      ${Math.abs(collateralChange).toLocaleString()} vs current
                    </div>
                  )}
                </div>
                
                <div>
                  <div className="text-muted-foreground">New Max Profit</div>
                  <div className="font-medium text-green-600">
                    +${newMaxProfit.toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <div className="text-muted-foreground">New Breakeven</div>
                  <div className="font-medium">
                    ${(newShortStrike - newEntryCredit).toFixed(2)}
                  </div>
                </div>
                
                <div>
                  <div className="text-muted-foreground">Contracts</div>
                  <div className="font-medium">
                    {newContracts || position.contracts}
                  </div>
                </div>
              </div>
            </div>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Roll
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
