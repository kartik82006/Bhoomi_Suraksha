import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import rescueImage from "../assets/img/national-disaster-response-force-ndrf-personnel-rescue-550nw-14139529e.jpeg";
import hazardMapImage from "../assets/img/8010.jpg.jxl";
import controlRoomImage from "../assets/img/BMC-to-set-up-disaster-control-rooms-at-hospitals.jpg";
import aerialFloodImage from "../assets/img/floods_012.jpg";
import reliefCampImage from "../assets/img/images.jpeg";

interface CarouselImage {
  src: string;
  alt: string;
  objectPosition?: string;
}

const CAROUSEL_IMAGES: CarouselImage[] = [
  { src: rescueImage, alt: "Disaster response personnel conducting a flood rescue" },
  { src: hazardMapImage, alt: "Hazard mapping reference image" },
  { src: aerialFloodImage, alt: "Aerial view of a flood-affected settlement" },
  { src: controlRoomImage, alt: "Disaster management control room monitoring operations" },
  { src: reliefCampImage, alt: "Temporary relief shelter and recovery site" },
];

function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % CAROUSEL_IMAGES.length);
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="hero-carousel" role="region" aria-label="Operational hazard and relief imagery">
      {CAROUSEL_IMAGES.map((image, index) => (
        <img
          key={`${image.src}-${index}`}
          className={`hero-carousel-image${index === activeIndex ? " is-active" : ""}`}
          src={image.src}
          alt={index === activeIndex ? image.alt : ""}
          aria-hidden={index !== activeIndex}
          style={{ objectPosition: image.objectPosition }}
        />
      ))}
      <div className="hero-carousel-caption">OPERATIONAL VIEW&nbsp; / &nbsp;SAMPLE REGION</div>
      <div className="hero-carousel-progress" aria-hidden="true">
        {CAROUSEL_IMAGES.map((image, index) => <span key={`${image.src}-progress-${index}`} className={index === activeIndex ? "is-active" : ""} />)}
      </div>
    </div>
  );
}

const HAZARD_LAYERS_MONITORED = 4;
const DISTRICTS_COVERED = 12;
const DATA_SOURCES_INTEGRATED = 6;

export function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  const steps = [
    { code: "01", title: "Data ingestion", description: "Terrain, rainfall, land use, population, and historical disaster records are collected, validated, and standardized for analysis." },
    { code: "02", title: "Hazard mapping", description: "Multi-hazard Red Zones are generated for landslide, flood, coastal erosion, and cloudburst risk using the standardized evidence base." },
    { code: "03", title: "Exposure & priority analysis", description: "Population and asset exposure is combined with hazard severity and disaster history into a transparent, explainable priority score for each settlement." },
    { code: "04", title: "Relocation planning", description: "Candidate sites are assessed for water access, land availability, road access, and carrying capacity, then matched to at-risk settlements." },
    { code: "05", title: "Human review", description: "Authorized officials review, approve, override, or defer every system recommendation before any action is taken." },
  ];

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header-inner">
          <BrandMark size={32} />
          <h1>Bhoomi Suraksha</h1>
        </div>
        <nav className="landing-nav">
          <a href="#about" className="nav-link">About</a>
          <a href="#how-it-works" className="nav-link">How it works</a>
          <button className="nav-button primary-button" onClick={() => onSignIn()}>Sign in</button>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <h2>Geospatial decision-support for hazard identification and relocation planning</h2>
          <p className="hero-subtext">
            A unified system for real-time hazard mapping, exposure analysis, and priority-driven relocation planning for State Disaster Management Authorities.
          </p>
          <button className="primary-button hero-cta" onClick={() => onSignIn()}>Access Dashboard</button>
        </div>
        <div className="hero-visual"><HeroCarousel /></div>
      </section>

      <section className="about-section" id="about">
        <div className="about-intro">
          <span className="section-kicker">ABOUT THE PLATFORM</span>
          <h2>Evidence-led planning for safer communities</h2>
          <p>Bhoomi Suraksha is a human-in-the-loop hazard and relocation decision-support platform built for State Disaster Management Authorities, the National Disaster Response Force, and the Ministry of Home Affairs. It brings hazard intelligence, population exposure, and relocation planning into one controlled workspace for authorized public officials.</p>
        </div>
        <div className="about-grid">
          <div className="about-statement">
            <span className="about-mark"><BrandMark size={26} /></span>
            <h3>Designed for decisions that must stand up to scrutiny.</h3>
            <p>Fragmented hazard data, static risk maps, and reactive relocation planning can delay action and make priorities difficult to explain. The platform connects current evidence to a traceable planning workflow, while officials retain approval and override authority at every stage; it does not make autonomous decisions.</p>
          </div>
          <div className="about-capabilities">
            <div className="capability-row"><span>01</span><strong>Common operating picture</strong><p>One map for hazards, exposed habitations, and potential relocation sites.</p></div>
            <div className="capability-row"><span>02</span><strong>Role-based access</strong><p>National, state, and public views respect operational data boundaries.</p></div>
            <div className="capability-row"><span>03</span><strong>Explainable prioritisation</strong><p>Risk scores can be inspected by the factors that produced them.</p></div>
          </div>
        </div>
      </section>

      <section className="how-it-works" id="how-it-works">
        <div className="section-header">
          <span className="section-kicker">DECISION WORKFLOW</span>
          <h2>From evidence to action</h2>
          <p className="section-subtitle">A consistent five-stage process for hazard-informed relocation planning.</p>
        </div>
        <div className="steps-grid">
          {steps.map((step, i) => (
            <div key={i} className="step-item" style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="step-circle">{step.code}</div>
              <span className="step-kicker">STAGE {step.code}</span>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="credibility-band">
        <div className="credibility-grid">
          <div className="credibility-card">
            <div className="card-number">{HAZARD_LAYERS_MONITORED}</div>
            <div className="card-label">Hazard layers monitored</div>
          </div>
          <div className="credibility-card">
            <div className="card-number">{DATA_SOURCES_INTEGRATED}</div>
            <div className="card-label">Data sources integrated</div>
          </div>
          <div className="credibility-card">
            <div className="card-number">{DISTRICTS_COVERED}</div>
            <div className="card-label">Districts covered</div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-inner">
          <span>Ministry of Home Affairs · National Disaster Response Force</span>
          <nav className="footer-nav">
            <a href="#">Data methodology</a>
            <a href="#">Terms of use</a>
            <a href="#">Privacy policy</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
