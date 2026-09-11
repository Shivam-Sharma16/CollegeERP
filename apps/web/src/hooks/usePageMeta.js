import { useEffect } from 'react';
import { useAppSelector } from '../store';
import { selectInstitutionName } from '../features/ui/themeSlice';

const usePageMeta = ({ title, description, isPublic = false }) => {
  const institutionName = useAppSelector(selectInstitutionName) || 'College ERP';

  useEffect(() => {
    // Set Document Title
    if (title) {
      document.title = `${title} | ${institutionName}`;
    }

    // Set Meta Description
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.name = 'description';
        document.head.appendChild(metaDescription);
      }
      metaDescription.content = description;
      
      // Open Graph Description
      let ogDescription = document.querySelector('meta[property="og:description"]');
      if (!ogDescription) {
        ogDescription = document.createElement('meta');
        ogDescription.setAttribute('property', 'og:description');
        document.head.appendChild(ogDescription);
      }
      ogDescription.content = description;
    }

    // Set Open Graph Title
    if (title) {
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.content = `${title} | ${institutionName}`;
    }

    // Set Robots Meta
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    
    if (isPublic) {
      robotsMeta.content = 'index, follow';
    } else {
      robotsMeta.content = 'noindex, nofollow';
    }

    return () => {
      // Optional: Clean up on unmount or just let subsequent renders overwrite
    };
  }, [title, description, isPublic]);
};

export default usePageMeta;
