\# 🛡️ VADER PROTOCOL: UI PROP SANITIZATION FIX



\*\*Issue:\*\* Custom project data props are leaking into the DOM, causing 13 React console errors.

\*\*System:\*\* Vader v2 / MSC Media Engine

\*\*Target File:\*\* `src/renderer/components/Msc\_ProjectCard.tsx` (and related Dashboard components)



\---



\## 🛠️ STEP 1: DESTRUCTURE CUSTOM PROPS

Update your component definitions to explicitly pull out the "Nuclear" props so they don't hit the HTML tags.



\### Replace your current component signature with this:



```tsx

// src/renderer/components/Msc\_ProjectCard.tsx



interface ProjectCardProps extends React.HTMLAttributes<HTMLDivElement> {

&#x20; projectId: string;

&#x20; projectName: string;

&#x20; portLock?: boolean;

&#x20; preferredPort?: number;

&#x20; detectedPackageManager?: string;

&#x20; detectedStartScript?: string;

&#x20; lastThumbnail?: string;

&#x20; createdAt?: string;

&#x20; lastLaunched?: string;

}



export const Msc\_ProjectCard: React.FC<ProjectCardProps> = ({

&#x20; // Destructure ALL custom props here to keep them out of ...rest

&#x20; projectId,

&#x20; projectName,

&#x20; portLock,

&#x20; preferredPort,

&#x20; detectedPackageManager,

&#x20; detectedStartScript,

&#x20; lastThumbnail,

&#x20; createdAt,

&#x20; lastLaunched,

&#x20; // Collect only valid HTML props (className, style, onClick, etc.)

&#x20; ...rest 

}) => {

&#x20; return (

&#x20;   <div 

&#x20;     {...rest} 

&#x20;     className={`msc-project-card ${rest.className || ''}`}

&#x20;     style={{ backgroundColor: '#1c1c1c', borderLeft: '4px solid #e02b20' }}

&#x20;   >

&#x20;     

&#x20;     <h3>{projectName}</h3>

&#x20;     <p>Port: {preferredPort || 'Auto'}</p>

&#x20;     

&#x20;   </div>

&#x20; );

};

