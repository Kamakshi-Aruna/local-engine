import * as fs from 'fs';
import * as path from 'path';

// Simplified CV generation for remaining CVs
async function generateCV(language: string, profileType: string, id: number): Promise<string> {
  const profiles = {
    backend_developer: {
      skills: ['Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'REST API'],
      title: 'Backend Developer'
    },
    frontend_developer: {
      skills: ['React', 'Vue.js', 'TypeScript', 'CSS', 'HTML5'],
      title: 'Frontend Developer'
    },
    fullstack_developer: {
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST API'],
      title: 'Full Stack Developer'
    },
    devops_engineer: {
      skills: ['Kubernetes', 'Docker', 'CI/CD', 'AWS', 'Terraform'],
      title: 'DevOps Engineer'
    }
  };

  const profile = profiles[profileType as keyof typeof profiles];
  const years = Math.floor(Math.random() * 8) + 2;

  const prompt = `Write a realistic CV for a ${profile.title} with ${years} years of experience. Include full name, contact info, professional summary, technical skills (${profile.skills.join(', ')}), work experience (2-3 positions), and education. Write in ${language}. DO NOT use generic terms like "mobile" or "developer" in skills - only specific technologies.`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 800,  // Shorter for speed
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
  console.log('🚀 Generating remaining CVs...\n');

  const outputDir = path.join(process.cwd(), 'cvs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cvConfigs = [
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

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Failed to generate CV ${config.id}:`, error);
    }
  }

  console.log('\n🎉 All CVs generated!');
  console.log(`📁 CVs saved to: ${outputDir}`);
}

main().catch(console.error);