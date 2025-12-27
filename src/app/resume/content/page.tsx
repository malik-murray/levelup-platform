'use client';

export default function ContentPage() {
  const videos = [
    {
      title: 'How to Prep for an Interview in 5 Minutes',
      description: 'Quick tips to prepare for any job interview',
      videoId: 'dQw4w9WgXcQ', // Placeholder - replace with actual video IDs
      duration: '5:23',
    },
    {
      title: 'How to Read a Job Description Strategically',
      description: 'Learn to identify key requirements and tailor your application',
      videoId: 'dQw4w9WgXcQ', // Placeholder
      duration: '7:15',
    },
    {
      title: 'ATS Optimization: What Recruiters Look For',
      description: 'Understanding Applicant Tracking Systems and how to optimize your resume',
      videoId: 'dQw4w9WgXcQ', // Placeholder
      duration: '10:42',
    },
    {
      title: 'Writing a Compelling Cover Letter',
      description: 'Tips for writing cover letters that get noticed',
      videoId: 'dQw4w9WgXcQ', // Placeholder
      duration: '8:30',
    },
  ];

  return (
    <div className="lg:ml-64 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Job Tips & Content</h1>
        <p className="text-slate-400 mb-8">
          Learn valuable tips and strategies for job applications, interviews, and career growth.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {videos.map((video, idx) => (
            <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
              <div className="aspect-video bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">▶️</div>
                  <p className="text-sm text-slate-400">Video Placeholder</p>
                  <p className="text-xs text-slate-500 mt-1">{video.duration}</p>
                </div>
                {/* In production, replace with actual YouTube embed:
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${video.videoId}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                */}
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2">{video.title}</h3>
                <p className="text-sm text-slate-400">{video.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-950/20 p-6">
          <h2 className="text-lg font-semibold mb-2">More Resources</h2>
          <p className="text-sm text-slate-400 mb-4">
            Check back regularly for new content and tips to help you succeed in your job search.
          </p>
          <a
            href="https://lus1.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-md bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors text-sm"
          >
            Visit Company Site
          </a>
        </div>
      </div>
    </div>
  );
}




