import * as fs from 'fs';
import * as path from 'path';

// CV generation script using Ollama
async function generateCV(language: string, profileType: string, id: number): Promise<string> {
  const languagePrompts: Record<string, string> = {
    english: 'Write a realistic CV in English',
    spanish: 'Escribe un CV realista en español',
    french: 'Écrivez un CV réaliste en français',
    german: 'Schreiben Sie einen realistischen Lebenslauf auf Deutsch',
    italian: 'Scrivi un CV realistico in italiano',
  };

  const profiles = {
    ios_developer: {
      skills: ['Swift', 'Objective-C', 'UIKit', 'SwiftUI', 'Core Data', 'iOS SDK', 'Xcode', 'TestFlight', 'App Store deployment'],
      experience: 'iOS application development',
      title: 'iOS Developer'
    },
    android_developer: {
      skills: ['Kotlin', 'Java', 'Android SDK', 'Jetpack Compose', 'Room Database', 'Retrofit', 'Android Studio', 'Google Play Console'],
      experience: 'Android application development',
      title: 'Android Developer'
    },
    flutter_developer: {
      skills: ['Flutter', 'Dart', 'Firebase', 'BLoC pattern', 'Provider', 'Cross-platform development', 'iOS and Android deployment'],
      experience: 'cross-platform mobile application development',
      title: 'Flutter Developer'
    },
    react_native_developer: {
      skills: ['React Native', 'JavaScript', 'TypeScript', 'Redux', 'Expo', 'Native modules', 'iOS and Android'],
      experience: 'React Native mobile development',
      title: 'React Native Developer'
    },
    backend_developer: {
      skills: ['Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'REST API', 'GraphQL', 'Docker', 'AWS', 'Microservices'],
      experience: 'backend development',
      title: 'Backend Developer'
    },
    frontend_developer: {
      skills: ['React', 'Vue.js', 'TypeScript', 'CSS', 'HTML5', 'Webpack', 'Jest', 'Responsive design'],
      experience: 'frontend web development',
      title: 'Frontend Developer'
    },
    fullstack_developer: {
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST API', 'Docker', 'Git', 'Agile'],
      experience: 'full-stack web development',
      title: 'Full Stack Developer'
    },
    devops_engineer: {
      skills: ['Kubernetes', 'Docker', 'CI/CD', 'AWS', 'Terraform', 'Jenkins', 'Linux', 'Monitoring'],
      experience: 'DevOps and infrastructure',
      title: 'DevOps Engineer'
    }
  };

  const profile = profiles[profileType as keyof typeof profiles];

  const prompt = `${languagePrompts[language]} for a ${profile.title} with ${Math.floor(Math.random() * 8) + 2} years of experience.

Include:
- Full name (realistic name for ${language} speaking region)
- Contact information
- Professional summary (2-3 sentences about ${profile.experience})
- Technical skills: ${profile.skills.slice(0, 5).join(', ')} and related technologies
- Work experience (2-3 positions with company names, dates, and responsibilities)
- Education (degree in Computer Science or related field)
- Optional: certifications, languages spoken, projects

Make it realistic and detailed. DO NOT use the words "mobile" or "developer" in the technical skills section - only list specific technologies and tools.

Write the full CV now:`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.9,
          num_predict: 1500,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error(`Error generating CV for ${profileType} in ${language}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting CV generation...\n');

  const outputDir = path.join(process.cwd(), 'cvs');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const languages = ['english', 'spanish', 'french', 'german', 'italian'];
  const profileTypes = [
    'ios_developer',
    'android_developer',
    'flutter_developer',
    'react_native_developer',
    'backend_developer',
    'frontend_developer',
    'fullstack_developer',
    'devops_engineer'
  ];

  // Generate 20 CVs with diverse profiles
  const cvConfigs = [
    // 8 mobile-related (iOS, Android, Flutter, React Native - 2 each)
    { lang: 'english', type: 'ios_developer', id: 1 },
    { lang: 'spanish', type: 'ios_developer', id: 2 },
    { lang: 'french', type: 'android_developer', id: 3 },
    { lang: 'german', type: 'android_developer', id: 4 },
    { lang: 'english', type: 'flutter_developer', id: 5 },
    { lang: 'italian', type: 'flutter_developer', id: 6 },
    { lang: 'spanish', type: 'react_native_developer', id: 7 },
    { lang: 'french', type: 'react_native_developer', id: 8 },

    // 12 non-mobile (backend, frontend, fullstack, devops - 3 each)
    { lang: 'english', type: 'backend_developer', id: 9 },
    { lang: 'german', type: 'backend_developer', id: 10 },
    { lang: 'spanish', type: 'backend_developer', id: 11 },
    { lang: 'french', type: 'frontend_developer', id: 12 },
    { lang: 'italian', type: 'frontend_developer', id: 13 },
    { lang: 'english', type: 'frontend_developer', id: 14 },
    { lang: 'german', type: 'fullstack_developer', id: 15 },
    { lang: 'spanish', type: 'fullstack_developer', id: 16 },
    { lang: 'french', type: 'fullstack_developer', id: 17 },
    { lang: 'english', type: 'devops_engineer', id: 18 },
    { lang: 'italian', type: 'devops_engineer', id: 19 },
    { lang: 'german', type: 'devops_engineer', id: 20 },
  ];

  for (const config of cvConfigs) {
    try {
      console.log(`📄 Generating CV ${config.id}/20: ${config.type} (${config.lang})...`);

      const cvContent = await generateCV(config.lang, config.type, config.id);

      const filename = `cv_${String(config.id).padStart(2, '0')}_${config.type}_${config.lang}.txt`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, cvContent, 'utf-8');

      console.log(`✅ Saved: ${filename}\n`);

      // Small delay to avoid overwhelming Ollama
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to generate CV ${config.id}:`, error);
    }
  }

  console.log('\n🎉 CV generation complete!');
  console.log(`📁 CVs saved to: ${outputDir}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the CVs in the 'cvs' directory`);
  console.log(`2. Run the ingestion script to upload them to Qdrant`);
  console.log(`3. Test search with: "Show me top 5 mobile developers"`);
}

main().catch(console.error);