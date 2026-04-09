import Hero from "@/components/custom/Hero";
import Features from "@/components/home/Features";
import Testimonials from "@/components/home/Testimonials";
import FAQ from "@/components/home/FAQ";
import HorizontalScrollFeatures from "@/components/home/HorizontalScrollFeatures";
import FOMOSection from "@/components/home/FOMOSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <FOMOSection />
      <Features />
      <HorizontalScrollFeatures />
      <Testimonials />
      <FAQ />
    </main>
  );
}
