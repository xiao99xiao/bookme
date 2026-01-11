import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Briefcase, Clock, DollarSign, Users } from "lucide-react";

interface BecomeProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

const BecomeProviderDialog = ({ open, onOpenChange, onConfirm, isLoading }: BecomeProviderDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Become a Provider
          </DialogTitle>
          <DialogDescription>
            Start earning by offering your services to others on Nook
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">Earn Money</h4>
                <p className="text-sm text-muted-foreground">
                  Set your own rates and receive payments directly through the platform
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <Clock className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">Flexible Schedule</h4>
                <p className="text-sm text-muted-foreground">
                  Control your availability and work when it suits you
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-purple-100 p-2">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium">Build Your Network</h4>
                <p className="text-sm text-muted-foreground">
                  Connect with customers and grow your professional reputation
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              As a provider, you'll be able to create services, manage bookings, and receive payments.
              You can switch between customer and provider modes anytime.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Maybe Later
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Setting up..." : "Yes, Become Provider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BecomeProviderDialog;