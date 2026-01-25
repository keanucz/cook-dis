import Link from 'next/link';
import { ChefHat, Sparkles, Mic, Image, ArrowRight, Play } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
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

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Cooking Made Visual & Interactive
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI generates stunning visuals and clear narration for every step, 
              so you always know exactly what to do.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Image className="h-8 w-8" />}
              title="AI Step Images"
              description="See what each step should look like with AI-generated images that match your recipe's instructions."
            />
            <FeatureCard
              icon={<Mic className="h-8 w-8" />}
              title="Voice Narration"
              description="Listen to step-by-step instructions with natural-sounding voice narration. Keep your hands free!"
            />
            <FeatureCard
              icon={<ChefHat className="h-8 w-8" />}
              title="Guided Cooking Mode"
              description="Full-screen cooking mode with easy navigation. Focus on cooking, not scrolling."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number="1"
              title="Import Recipe"
              description="Paste a recipe URL or search for recipes by name."
            />
            <StepCard
              number="2"
              title="AI Generates"
              description="We create images and audio for each cooking step."
            />
            <StepCard
              number="3"
              title="Start Cooking"
              description="Enter cooking mode and follow along step by step."
            />
            <StepCard
              number="4"
              title="Enjoy!"
              description="Complete your dish and celebrate with confetti! 🎉"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-orange-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Cooking?
          </h2>
          <p className="text-lg text-orange-100 mb-8">
            Join thousands of home cooks who are making delicious meals with AI guidance.
          </p>
          <Link
            href="/login"
            className="btn bg-white text-orange-600 hover:bg-gray-100 text-lg px-8 py-3 inline-flex items-center gap-2"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">👨‍🍳</span>
            <span className="text-white font-bold">Cook-Dis</span>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} Cook-Dis. Made with ❤️ for home cooks everywhere.
          </p>
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
    <div className="text-center p-8 rounded-md bg-white border border-gray-200 hover:border-orange-200 hover:shadow-md transition-all duration-300">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-md bg-orange-50 text-orange-600 mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-orange-500 text-white font-bold text-lg mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}
