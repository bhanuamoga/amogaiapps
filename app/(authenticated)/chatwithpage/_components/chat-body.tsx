import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { FileSearch, BarChart, ClipboardList, Lightbulb, Bot as BotIcon } from "lucide-react";

// Add this type!
type ChatBodyProps = {
  chatUuid: string;
};

const suggestions = [
  {
    title: "Analyze Documents",
    description: "Get insights from your files",
    icon: FileSearch,
  },
  {
    title: "Create Visualization",
    description: "Generate charts from your data",
    icon: BarChart,
  },
  {
    title: "Summarize Content",
    description: "Extract key information",
    icon: ClipboardList,
  },
  {
    title: "Get Insights",
    description: "Receive smart recommendations",
    icon: Lightbulb,
  },
];

function SuggestionCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: any;
}) {
  return (
    <Card className="rounded-md w-full">
      <button
        type="button"
        className="flex items-start gap-3 w-full h-full p-6 bg-transparent rounded-md text-left"
      >
        <Icon className="w-5 h-5 mt-1 text-muted-foreground" strokeWidth={1.8} />
        <span>
          <span className="block text-base font-semibold text-foreground">{title}</span>
          <span className="block text-[15px] text-muted-foreground">{description}</span>
        </span>
      </button>
    </Card>
  );
}

// Accept chatUuid *here*
export default function ChatBody({ chatUuid }: ChatBodyProps) {
  return (
    <div className="py-10">
      <div className="max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-16 h-16 mb-7 rounded-full bg-muted flex items-center justify-center">
          <BotIcon className="w-8 h-8 text-foreground" />
        </div>
        <h1 className="text-center font-bold text-3xl mb-2">Welcome to AI Chat</h1>
        <p className="text-center text-muted-foreground mb-10 text-[17px] font-normal">
          How can I help you today? Choose a suggestion below or start typing your own question.
        </p>
        <div className="grid gap-4 w-full grid-cols-1 sm:grid-cols-2 mb-4">
          {suggestions.map(s => (
            <SuggestionCard key={s.title} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
