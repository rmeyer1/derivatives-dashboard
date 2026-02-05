"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatePositionRequest } from "@/types/dashboard";

interface AddPositionDialogProps {
  onPositionAdded: () => void;
}

export function AddPositionDialog({ onPositionAdded }: AddPositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<"Call" | "Put">("Call");
  const [strike, setStrike] = useState("");
  const [expiration, setExpiration] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const positionData: CreatePositionRequest = {
      symbol,
      type,
      strike: parseFloat(strike),
      expiration,
      quantity: parseInt(quantity),
      avgPrice: parseFloat(avgPrice),
    };

    try {
      const response = await fetch("/api/positions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(positionData),
      });

      if (!response.ok) {
        throw new Error("Failed to create position");
      }

      // Reset form
      setSymbol("");
      setType("Call");
      setStrike("");
      setExpiration("");
      setQuantity("");
      setAvgPrice("");
      setOpen(false);
      onPositionAdded(); // Refresh the positions list
    } catch (error) {
      console.error("Error creating position:", error);
      alert("Failed to create position. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">+ Add Position</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Position</DialogTitle>
          <DialogDescription>
            Enter the details of your new options position.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="symbol" className="text-right">
                Symbol
              </Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Select value={type} onValueChange={(value: "Call" | "Put") => setType(value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Call">Call</SelectItem>
                  <SelectItem value="Put">Put</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="strike" className="text-right">
                Strike
              </Label>
              <Input
                id="strike"
                type="number"
                step="0.01"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expiration" className="text-right">
                Expiration
              </Label>
              <Input
                id="expiration"
                type="date"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="avgPrice" className="text-right">
                Avg Price
              </Label>
              <Input
                id="avgPrice"
                type="number"
                step="0.01"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Add Position</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}