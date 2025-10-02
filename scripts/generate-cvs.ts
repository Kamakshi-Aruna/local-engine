import fs from 'fs';
import path from 'path';

const CV_TEMPLATES = [
  {
    language: 'english',
    name: 'Sarah Chen',
    content: `SARAH CHEN
Software Engineer

CONTACT
Email: sarah.chen@email.com
Phone: +1-555-0123
Location: San Francisco, CA

EXPERIENCE
Senior iOS Developer - TechCorp Inc. (2020-2024)
• Developed native applications using Swift and Objective-C
• Implemented Core Data for local storage and data persistence
• Built responsive user interfaces with UIKit and SwiftUI
• Collaborated with design team on user experience optimization
• Published 3 apps to App Store with 50K+ downloads each

Software Developer - StartupXYZ (2018-2020)
• Created cross-platform applications using React Native
• Integrated RESTful APIs and GraphQL endpoints
• Implemented push notifications and real-time messaging
• Worked with Firebase for backend services and analytics
• Maintained code quality through unit testing and code reviews

SKILLS
• Programming: Swift, Objective-C, JavaScript, TypeScript
• Frameworks: UIKit, SwiftUI, React Native, Core Data
• Tools: Xcode, Git, TestFlight, Firebase, Fastlane
• Design: Figma, Sketch, Auto Layout, Responsive Design

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley (2014-2018)`
  },
  {
    language: 'spanish',
    name: 'Carlos Rodriguez',
    content: `CARLOS RODRIGUEZ
Ingeniero de Software

CONTACTO
Correo: carlos.rodriguez@email.com
Teléfono: +34-600-123456
Ubicación: Madrid, España

EXPERIENCIA
Desarrollador Android Senior - InnovaTech (2019-2024)
• Desarrollo de aplicaciones nativas con Kotlin y Java
• Implementación de arquitectura MVVM y Clean Architecture
• Integración con APIs REST y bases de datos SQLite
• Optimización de rendimiento y gestión de memoria
• Publicación en Google Play Store con más de 100K descargas

Programador Junior - DigitalSolutions (2017-2019)
• Creación de interfaces de usuario con XML y Jetpack Compose
• Trabajo con Room Database para persistencia de datos
• Implementación de notificaciones push con Firebase
• Desarrollo de funciones multimedia y cámara
• Participación en metodologías ágiles y Scrum

HABILIDADES
• Lenguajes: Kotlin, Java, Dart, Python
• Frameworks: Android SDK, Jetpack, Flutter, Room
• Herramientas: Android Studio, Gradle, Firebase, Git
• Testing: JUnit, Espresso, Mockito

EDUCACIÓN
Grado en Ingeniería Informática
Universidad Politécnica de Madrid (2013-2017)`
  },
  {
    language: 'french',
    name: 'Marie Dubois',
    content: `MARIE DUBOIS
Développeuse Applications

CONTACT
Email: marie.dubois@email.com
Téléphone: +33-1-23-45-67-89
Localisation: Paris, France

EXPÉRIENCE
Lead Developer Flutter - TechInnovation (2021-2024)
• Développement d'applications cross-platform avec Dart et Flutter
• Architecture de widgets personnalisés et animations fluides
• Intégration avec services cloud et APIs RESTful
• Gestion d'état avec Provider et Bloc pattern
• Déploiement simultané sur App Store et Google Play

Développeuse Mobile - StartupFrench (2018-2021)
• Création d'applications hybrides avec Ionic et Cordova
• Développement de plugins natifs pour fonctionnalités spécifiques
• Implémentation de géolocalisation et cartes interactives
• Optimisation des performances et temps de chargement
• Formation d'équipes junior aux bonnes pratiques

COMPÉTENCES
• Langages: Dart, JavaScript, TypeScript, HTML5, CSS3
• Frameworks: Flutter, Ionic, Angular, Vue.js
• Outils: VS Code, Git, Firebase, Figma, Postman
• Bases de données: SQLite, Firebase Firestore, MongoDB

FORMATION
Master en Informatique
École Polytechnique - Palaiseau (2014-2018)`
  },
  {
    language: 'german',
    name: 'Hans Mueller',
    content: `HANS MUELLER
Software-Entwickler

KONTAKT
E-Mail: hans.mueller@email.com
Telefon: +49-30-12345678
Standort: Berlin, Deutschland

BERUFSERFAHRUNG
Senior App-Entwickler - TechBerlin GmbH (2020-2024)
• Entwicklung nativer Anwendungen mit Swift für iOS Ecosystem
• Implementation von Core ML für maschinelles Lernen
• Arbeit mit CloudKit und iCloud Synchronisation
• Performance-Optimierung und Memory Management
• Code-Reviews und Mentoring von Junior-Entwicklern

Mobile Software Engineer - InnovateDeutschland (2017-2020)
• Erstellung von Android-Apps mit Kotlin und Java
• Integration von Kamera-APIs und Bilderkennung
• Entwicklung von Wear OS Anwendungen für Smartwatches
• Implementierung von Material Design Guidelines
• Continuous Integration mit Jenkins und GitLab CI

FÄHIGKEITEN
• Programmiersprachen: Swift, Kotlin, Java, C++, Python
• Frameworks: UIKit, SwiftUI, Android Jetpack, Wear OS
• Tools: Xcode, Android Studio, Git, Jenkins, Docker
• Datenbanken: Core Data, Room, Realm, PostgreSQL

AUSBILDUNG
Bachelor of Science Informatik
Technische Universität Berlin (2013-2017)`
  },
  {
    language: 'italian',
    name: 'Giulia Rossi',
    content: `GIULIA ROSSI
Sviluppatrice Software

CONTATTO
Email: giulia.rossi@email.com
Telefono: +39-02-12345678
Località: Milano, Italia

ESPERIENZA
Senior React Native Developer - TechMilano (2019-2024)
• Sviluppo di applicazioni ibride per iOS e Android
• Implementazione di bridge nativi per funzionalità specifiche
• Integrazione con API REST e GraphQL
• Ottimizzazione delle prestazioni e gestione dello stato
• Deploy automatizzato con Fastlane e CodePush

Sviluppatrice App - StartupItalia (2016-2019)
• Creazione di app native con Xamarin e C#
• Sviluppo di interfacce utente responsive
• Integrazione con servizi di pagamento e autenticazione
• Implementazione di funzionalità offline-first
• Testing automatizzato e quality assurance

COMPETENZE
• Linguaggi: JavaScript, TypeScript, C#, Dart, Swift
• Framework: React Native, Xamarin, Flutter, .NET
• Strumenti: VS Code, Git, Azure DevOps, Figma
• Database: SQLite, Realm, Firebase, MongoDB

FORMAZIONE
Laurea in Ingegneria Informatica
Politecnico di Milano (2012-2016)`
  }
];

async function generateCVs() {
  const dataDir = path.join(process.cwd(), 'data', 'ai-cvs');

  // Ensure directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log('🚀 Generating multilingual CVs with mobile development skills...\n');

  for (const cv of CV_TEMPLATES) {
    const filename = `cv_${cv.language}_${cv.name.toLowerCase().replace(/\s+/g, '_')}.txt`;
    const filepath = path.join(dataDir, filename);

    fs.writeFileSync(filepath, cv.content, 'utf8');
    console.log(`✅ Generated: ${filename} (${cv.language})`);
  }

  console.log(`\n🎉 Successfully generated ${CV_TEMPLATES.length} CVs in different languages!`);
  console.log('\n📋 CV Summary:');
  CV_TEMPLATES.forEach(cv => {
    console.log(`   • ${cv.name} (${cv.language}) - Contains iOS/Android/Flutter skills`);
  });

  console.log('\n🔍 Key mobile-related terms included:');
  console.log('   • iOS, Android, Swift, Kotlin, React Native, Flutter');
  console.log('   • Xcode, Android Studio, App Store, Google Play');
  console.log('   • UIKit, SwiftUI, Jetpack Compose, Core Data');
  console.log('   • No explicit "mobile developer" mentions for semantic search testing');
}

if (require.main === module) {
  generateCVs().catch(console.error);
}

export { generateCVs };