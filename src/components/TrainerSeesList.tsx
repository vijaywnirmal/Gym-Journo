// What a trainer sees once someone accepts them, shown wherever that choice is made.
export default function TrainerSeesList({
  name,
  heading: Heading = "h2",
  className = "",
}: {
  name: string;
  heading?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={`text-sm ${className}`}>
      <Heading className="font-semibold">{name} will see</Heading>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-label-2">
        <li>Your workout plans, and can plan workouts for you</li>
        <li>Your logged workouts, including notes</li>
        <li>Your body weight</li>
        <li>Your name, goal, experience and training days</li>
      </ul>
      <Heading className="mt-4 font-semibold">{name} won&apos;t see</Heading>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-label-2">
        <li>Your email, date of birth, height or gender</li>
        <li>Coach, AI plans or meals</li>
      </ul>
    </div>
  );
}
