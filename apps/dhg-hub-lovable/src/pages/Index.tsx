import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CalendarDays, Users, BookOpen } from "lucide-react";

const Index = () => {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold text-primary mb-4">
          Dynamic Healing Discussion Group
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Exploring the Neurophysiological Foundations of Chronic Disease Through Expert Collaboration
        </p>
        
        {/* Meeting Info Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg mb-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center">
              <CalendarDays className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Regular Meetings</h3>
              <p className="text-sm text-gray-600">1st & 3rd Wednesdays</p>
              <p className="text-sm text-gray-600">5 PM PT / 8 PM ET</p>
            </div>
            <div className="flex flex-col items-center">
              <Users className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Join Us</h3>
              <a href="https://us02web.zoom.us/j/98327644404" className="text-sm text-blue-600 hover:underline">
                Zoom Meetings
              </a>
            </div>
            <div className="flex flex-col items-center">
              <BookOpen className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Past Recordings</h3>
              <a href="https://drive.google.com/drive/folders/1wriOM2j2IglnMcejplqG_XcCxSIfoRMV?usp=sharing" 
                 className="text-sm text-blue-600 hover:underline">
                Access Archives
              </a>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center mb-12">
          <Button size="lg" variant="primary" asChild>
            <Link to="/experts">View Our Experts</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/document-types">Browse Resources</Link>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader>
            <CardTitle className="text-teal-600">Research Focus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Exploring chronic disease through the lens of the autonomic nervous system, with special emphasis on The Polyvagal Theory and neurophysiological responses.
            </p>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 hover:border-secondary/40 transition-colors">
          <CardHeader>
            <CardTitle className="text-teal-600">Collaborative Approach</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Scientists, researchers, and healthcare clinicians sharing insights on neurophysiological foundations of chronic mental and physical disease.
            </p>
          </CardContent>
        </Card>

        <Card className="border-accent/20 hover:border-accent/40 transition-colors">
          <CardHeader>
            <CardTitle className="text-teal-600">Key Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-gray-600 text-left list-disc pl-4 space-y-1">
              <li>Autonomic nervous system's role</li>
              <li>Cytokine and metabolic factors</li>
              <li>Vagal nerve stimulation</li>
              <li>Social factors in healing</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Index;