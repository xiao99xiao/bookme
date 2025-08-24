import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Booking {
  id: string;
  customerName: string;
  serviceName: string;
  serviceDescription: string;
  date: string;
  time: string;
  status: "active" | "completed" | "upcoming" | "cancelled";
  serviceType: "online" | "in-person";
  location?: string;
  meetingLink?: string;
  avatar?: string;
  price: number;
}

interface CancelBookingModalProps {
  booking: Booking | null;
  isProvider: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (bookingId: string) => void;
}

export const CancelBookingModal = ({ 
  booking, 
  isProvider, 
  isOpen, 
  onClose, 
  onConfirm 
}: CancelBookingModalProps) => {
  const [communicationDone, setCommunicationDone] = useState(false);
  const { toast } = useToast();

  const handleConfirm = () => {
    if (!booking) return;
    
    if (isProvider && !communicationDone) {
      toast({
        title: "Please confirm communication",
        description: "You must confirm that you've contacted the customer before cancelling.",
        variant: "destructive",
      });
      return;
    }

    onConfirm(booking.id);
    handleClose();
  };

  const handleClose = () => {
    setCommunicationDone(false);
    onClose();
  };

  const handleCheckboxToggle = () => {
    setCommunicationDone(!communicationDone);
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isProvider ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                As a provider, you should contact the customer to explain the reason for cancellation before proceeding.
              </p>
              <div 
                className="flex items-center space-x-2 cursor-pointer" 
                onClick={handleCheckboxToggle}
              >
                <Checkbox
                  checked={communicationDone}
                  onCheckedChange={(checked) => setCommunicationDone(checked === true)}
                />
                <span className="text-sm select-none">
                  I have contacted the customer and explained the reason for cancellation
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleConfirm}
                  disabled={!communicationDone}
                  variant="destructive"
                  className="flex-1"
                >
                  Confirm Cancellation
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1"
                >
                  Keep Booking
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You can only cancel bookings up to 12 hours before the scheduled time. After that, please contact the provider directly.
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleConfirm}
                  variant="destructive"
                  className="flex-1"
                >
                  Cancel Booking
                </Button>
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1"
                >
                  Keep Booking
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const CancelBookingTrigger = ({ 
  booking, 
  onCancel 
}: { 
  booking: Booking; 
  onCancel: (booking: Booking) => void; 
}) => {
  if (booking.status === "completed" || booking.status === "cancelled") {
    return null;
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={() => onCancel(booking)}
      className="text-muted-foreground hover:text-foreground"
    >
      <X className="h-4 w-4 mr-1" />
      Cancel
    </Button>
  );
};