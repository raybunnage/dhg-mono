interface AudioPlayerProps {
  url: string
}

export function AudioPlayer({ url }: AudioPlayerProps) {
  return (
    <div className="max-w-md">
      <audio controls className="w-full">
        <source src={url} type="audio/m4a" />
        Your browser does not support the audio element.
      </audio>
    </div>
  )
} 