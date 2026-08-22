import { ArrowRight } from "lucide-react";
import { StackMark } from "../../components/shared/StackMark";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";

interface WelcomeSheetProps {
  isOpen: boolean;
  onGetStarted: () => void;
  onDismiss: () => void;
}

export function WelcomeSheet({ isOpen, onGetStarted, onDismiss }: WelcomeSheetProps) {
  return (
    <Sheet title="STACK" isOpen={isOpen} onClose={onDismiss} className="welcome-sheet">
      <div className="welcome-intro">
        <StackMark size={40} />
        <h2>Build your running.</h2>
        <p>
          Every run becomes part of your history and earns a block. Add a race
          plan when you want scheduled intent; STACK works before and between races.
        </p>
        <Button icon={<ArrowRight size={18} />} onClick={onGetStarted}>
          Get Started
        </Button>
      </div>
    </Sheet>
  );
}
