
{/* ── VIDEO INTRO ── */}
{showIntro && (
  <div className="fixed inset-0 z-[9999] bg-black">
    <video
      autoPlay
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
      onEnded={() => {
        setShowIntro(false);
        setMapProjection("globe");
      }}
      onError={() => {
        setShowIntro(false);
        setMapProjection("globe");
      }}
    >
      <source src="/intro.mp4" type="video/mp4" />
    </video>

    <button
      type="button"
      onClick={() => {
        setShowIntro(false);
        setMapProjection("globe");
      }}
      className="absolute bottom-8 right-8 z-10 rounded-lg border border-white/30 bg-black/60 px-6 py-3 font-mono text-sm tracking-widest text-white"
    >
      SKIP INTRO
    </button>
  </div>
)}
