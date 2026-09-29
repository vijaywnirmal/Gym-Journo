import Image from "next/image";

// Start/end-position photos played as a two-frame loop: the end frame fades in and out over the
// start frame. With reduced motion the frames sit side by side instead of animating.
export default function ExerciseDemo({ images, name }: { images: string[]; name: string }) {
  const [start, end] = images;
  if (!start) return null;

  return (
    <div className="exercise-demo relative w-full max-w-xs overflow-hidden rounded-lg bg-white">
      <Image
        src={start}
        alt={`${name}: start position`}
        width={480}
        height={320}
        className="exercise-demo-start h-auto w-full"
        unoptimized
      />
      {end && (
        <Image
          src={end}
          alt={`${name}: end position`}
          width={480}
          height={320}
          className="exercise-demo-end h-auto w-full"
          unoptimized
        />
      )}
    </div>
  );
}
