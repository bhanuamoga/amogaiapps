/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
    Search,
    Clock,
    Trash,
    X,
    Heart,
    Star,
    Flag,
    Archive,
    RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
    getPromptHistory,
    deletePrompt,
} from "@/app/(authenticated)/chatwithpage/actions";

export default function PromptHistoryPage() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [prompts, setPrompts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        const data = await getPromptHistory();
        setPrompts(data || []);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async (uuid: string) => {
        const res = await deletePrompt(uuid);
        if (res.success) {
            toast.success("Prompt deleted");
            setPrompts(prev => prev.filter(p => p.promptUuid !== uuid));
        } else {
            toast.error("Failed to delete");
        }
    };

    // -----------------------
    // FILTERING + SEARCH
    // -----------------------
    const filtered = prompts
        .filter((p) => p.title?.toLowerCase().includes(search.toLowerCase()))
        .filter((p) => {
            if (filter === "favorite") return p.favorite === true;
            if (filter === "important") return p.important === true;
            if (filter === "action") return p.action_item === true;
            if (filter === "archived") return p.archive_status === true;
            return true;
        });

    return (
        <div className="flex flex-col p-6 w-full max-w-2xl mx-auto animate-fade-in">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-semibold">Prompt History</h1>

                <Button variant="default" onClick={() => history.back()}>
                    <X className="h-5 w-5" />Close
                </Button>
            </div>

            {/* SEARCH BAR */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                <Input
                    placeholder="Search prompt history..."
                    className="pl-9 w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* FILTER BUTTONS */}
            <div className="flex gap-2 mb-6 flex-wrap">
                <Button
                    variant={filter === "all" ? "default" : "outline"}
                    onClick={() => setFilter("all")}
                >
                    All Prompts
                </Button>

                <Button
                    variant={filter === "favorite" ? "default" : "outline"}
                    onClick={() => setFilter("favorite")}
                    className="gap-1"
                >
                    <Heart className="h-4 w-4" /> Favorite
                </Button>

                <Button
                    variant={filter === "important" ? "default" : "outline"}
                    onClick={() => setFilter("important")}
                    className="gap-1"
                >
                    <Star className="h-4 w-4" /> Important
                </Button>

                <Button
                    variant={filter === "action" ? "default" : "outline"}
                    onClick={() => setFilter("action")}
                    className="gap-1"
                >
                    <Flag className="h-4 w-4" /> Action Items
                </Button>

                <Button
                    variant={filter === "archived" ? "default" : "outline"}
                    onClick={() => setFilter("archived")}
                    className="gap-1"
                >
                    <Archive className="h-4 w-4" /> Archived
                </Button>
            </div>

            {/* LIST AREA */}
            <div className="min-h-[350px] flex flex-col gap-3">

                {loading ? (
                    <div className="flex justify-center items-center opacity-70">
                        Loading...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-[300px] opacity-70">
                        <RotateCcw className="h-10 w-10 mb-3" />
                        <div className="text-lg font-medium">No messages found</div>
                        <div className="text-sm">No messages match the selected filter</div>
                    </div>
                ) : (
                    filtered.map((item) => (
                        <Card
                            key={item.promptUuid}
                            className="p-4 flex flex-col gap-2 h-[120px]"
                        >
                            {/* TITLE */}
                            <div className="font-medium text-base overflow-hidden text-ellipsis whitespace-nowrap">
                                {item.title}
                            </div>

                            {/* DATE */}
                            <div className="text-sm flex items-center gap-1 opacity-70">
                                <Clock className="h-4 w-4" />
                                {new Date(item.createdAt).toLocaleString()}
                            </div>

                            {/* ACTIONS */}
                            <div className="flex justify-end pt-2 border-t">
                                <Trash
                                    className="h-5 w-5 cursor-pointer opacity-60 hover:text-destructive"
                                    onClick={() => handleDelete(item.promptUuid)}
                                />
                            </div>
                        </Card>

                    ))
                )}
            </div>

        </div>
    );
}
