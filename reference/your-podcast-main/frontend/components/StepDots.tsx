export function StepDots({
  currentStep,
  totalSteps,
}: {
  readonly currentStep: number;
  readonly totalSteps: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`size-1.5 rounded-full ${
            i === currentStep ? 'bg-black' : 'bg-black/20'
          }`}
        />
      ))}
    </div>
  );
}
