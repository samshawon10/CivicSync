import { Helmet } from 'react-helmet-async';

export default function PageHead({ title, description = 'CivicSync public safety and emergency services.' }) {
  const fullTitle = title ? `${title} | CivicSync` : 'CivicSync';
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
}
