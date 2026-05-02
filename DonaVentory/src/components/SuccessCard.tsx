import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SuccessCardProps {
  message: string;
  onReset: () => void;
  resetLabel?: string;
}

export default function SuccessCard({ message, onReset, resetLabel = 'Log Another Product' }: SuccessCardProps) {
  return (
    <div className="p-8 max-w-2xl">
      <Card>
        <CardContent className="flex flex-col items-center text-center gap-4 px-8 py-10">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <div>
            <p className="text-base font-semibold text-foreground">Intake recorded</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          <Button onClick={onReset} className="mt-2">
            {resetLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
