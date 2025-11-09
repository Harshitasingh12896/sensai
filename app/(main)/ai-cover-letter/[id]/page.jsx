import { getCoverLetter } from "@/actions/cover-letter";
import CoverLetterPreview from "../_components/cover-letter-preview";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function CoverLetterViewPage({ params }) {
  // Fetch cover letter by ID
  const letter = await getCoverLetter(params.id);

  if (!letter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Cover Letter Not Found
        </h2>
        <p className="text-gray-500 mb-6">
          It looks like this cover letter doesn't exist or you don't have access to it.
        </p>
        <Link href="/ai-cover-letter">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Cover Letters
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold gradient-title">
          {letter.jobTitle} @ {letter.companyName}
        </h1>
        <Link href="/ai-cover-letter">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div className="text-sm text-muted-foreground">
        Created on {new Date(letter.createdAt).toLocaleDateString()}
      </div>

      <CoverLetterPreview content={letter.content} />
    </div>
  );
}
