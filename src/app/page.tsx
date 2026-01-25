import Link from 'next/link';
import { Sparkles, Mic, Image, ArrowRight, Zap, Heart, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          {/* Chef Emoji - Large and centered */}
          <div className="mb-8 animate-scale-in">
            <div className="text-9xl mb-4 animate-float">👨‍🍳</div>
          </div>
          
          {/* Title */}
          <h1 className="text-6xl sm:text-7xl font-bold text-gray-900 mb-6 animate-slide-up">
            Cook Dis
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto animate-slide-up animation-delay-100">
            Gentle step-by-step walkthroughs of your favourite recipes
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up animation-delay-200">
            <Link
              href="/login"
              className="btn btn-primary text-base px-8 py-3 min-w-[140px]"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="btn btn-secondary text-base px-8 py-3 min-w-[140px]"
            >
              Sign up
            </Link>
          </div>
        </div>
        
        {/* Subtle background elements */}
        <div className="absolute top-1/4 left-10 w-2 h-2 bg-orange-400 rounded-full opacity-40" />
        <div className="absolute top-1/3 right-20 w-3 h-3 bg-orange-300 rounded-full opacity-30" />
        <div className="absolute bottom-1/4 left-1/4 w-2 h-2 bg-orange-500 rounded-full opacity-20" />
      </section>

      {/* Features Section - Redesigned for consistency */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              How it works
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Cooking reimagined with AI
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We transform any recipe into an interactive cooking experience
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Image className="h-6 w-6" />}
              title="Visual Steps"
              description="AI-generated images show you exactly what each step should look like"
            />
            <FeatureCard
              icon={<Mic className="h-6 w-6" />}
              title="Voice Guide"
              description="Natural voice narration keeps your hands free while cooking"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Smart Mode"
              description="Full-screen cooking mode designed for your kitchen workflow"
            />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <StatCard
              icon={<Users className="h-6 w-6" />}
              value="10,000+"
              label="Home cooks"
            />
            <StatCard
              icon={<Heart className="h-6 w-6" />}
              value="50,000+"
              label="Recipes cooked"
            />
            <StatCard
              icon={<Sparkles className="h-6 w-6" />}
              value="100%"
              label="AI-powered"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-500 to-orange-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Start cooking smarter today
          </h2>
          <p className="text-lg text-orange-100 mb-8">
            Join home cooks making delicious meals with AI guidance
          </p>
          <Link
            href="/login"
            className="btn bg-white text-orange-600 hover:bg-gray-50 text-base px-8 py-3 inline-flex items-center gap-2"
          >
            Get started free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-3xl">👨‍🍳</span>
              <span className="text-xl font-bold text-white">Cook-Dis</span>
            </div>
            <p className="text-gray-400 text-sm text-center mb-6">
              AI-powered cooking guidance for home chefs
            </p>
            <div className="flex gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">About</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Support</a>
            </div>
            <p className="text-gray-500 text-xs mt-8">
              © {new Date().getFullYear()} Cook-Dis. Made with ❤️ for home cooks everywhere.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-md bg-white border border-gray-200 hover:border-orange-200 hover:shadow-sm transition-all duration-300">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-orange-50 text-orange-600 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-orange-50 text-orange-600 mb-3">
        {icon}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
