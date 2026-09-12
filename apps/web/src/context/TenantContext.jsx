import React, { createContext, useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useResolveInstitutionBySlugQuery } from '../api/institutionsApi';
import { useAppDispatch } from '../store';
import { patchTheme, loadTheme } from '../features/ui/themeSlice';

const TenantContext = createContext({
  tenant: null,
  slug: null,
  isTenantPortal: false,
  isLoading: false,
  error: null,
});

export function TenantProvider({ children }) {
  const { slug } = useParams();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (slug) {
      dispatch(loadTheme(slug));
    }
  }, [slug, dispatch]);

  const {
    data: tenant,
    isLoading,
    error,
  } = useResolveInstitutionBySlugQuery(slug, {
    skip: !slug,
  });

  useEffect(() => {
    if (tenant) {
      // Dynamic Theme injection for Tenant
      const branding = tenant.branding || {};
      const primaryColor = branding.primaryColor || '#4f46e5';
      const secondaryColor = branding.secondaryColor || '#06b6d4';

      dispatch(
        patchTheme({
          '--color-primary': primaryColor,
          '--color-secondary': secondaryColor,
        })
      );

      // Title & Favicon
      document.title = `${tenant.name} | ERP Portal`;
      if (branding.faviconUrl) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = branding.faviconUrl;
      }
    }
  }, [tenant, dispatch]);

  return (
    <TenantContext.Provider
      value={{
        tenant: tenant || null,
        slug: slug || null,
        isTenantPortal: Boolean(slug),
        isLoading,
        error,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
