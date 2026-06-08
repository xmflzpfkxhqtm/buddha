'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function CopyIdRedirect() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    router.replace(`/practice/copy/${id}`);
  }, [router, id]);
  return null;
}
