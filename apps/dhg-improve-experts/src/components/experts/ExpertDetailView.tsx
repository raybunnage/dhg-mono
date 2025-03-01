import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExpertInterface, ExpertDocument, EnhancedExpertProfile } from '@/types/expert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExpertDocumentList } from './ExpertDocumentList';
import { Edit, RefreshCw, User, Briefcase, GraduationCap, Award, BookOpen, Globe } from 'lucide-react';
import { format } from 'date-fns';

interface ExpertDetailViewProps {
  expert: ExpertInterface;
  onEdit: (expert: ExpertInterface) => void;
  onSelectDocument: (document: ExpertDocument) => void;
  onAddDocument: () => void;
  onEditDocument: (document: ExpertDocument) => void;
  onDeleteDocument: (document: ExpertDocument) => void;
  onProcessDocument: (document: ExpertDocument) => void;
}

export function ExpertDetailView({
  expert,
  onEdit,
  onSelectDocument,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onProcessDocument
}: ExpertDetailViewProps) {
  const [loading, setLoading] = useState(false);
  const [enhancedProfile, setEnhancedProfile] = useState<EnhancedExpertProfile | null>(null);
  const [jsonView, setJsonView] = useState(false);

  useEffect(() => {
    loadEnhancedProfile();
  }, [expert.id]);

  async function loadEnhancedProfile() {
    try {
      setLoading(true);
      
      // Get the latest processed document with enhanced profile information
      const { data, error } = await supabase
        .from('expert_documents')
        .select('*')
        .eq('expert_id', expert.id)
        .eq('processing_status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0 && data[0].processed_content) {
        // Parse the enhanced profile from the processed content
        try {
          const processedContent = data[0].processed_content;
          if (typeof processedContent === 'string') {
            setEnhancedProfile(JSON.parse(processedContent));
          } else {
            setEnhancedProfile(processedContent);
          }
        } catch (parseError) {
          console.error('Error parsing enhanced profile:', parseError);
        }
      }
    } catch (error) {
      console.error('Error loading enhanced profile:', error);
      toast.error('Failed to load enhanced expert profile');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{expert.expert_name}</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setJsonView(!jsonView)}>
            {jsonView ? 'Formatted View' : 'JSON View'}
          </Button>
          <Button variant="outline" onClick={loadEnhancedProfile}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => onEdit(expert)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Expert
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced Profile</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Full Name</div>
                <div>{expert.full_name || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Email</div>
                <div>{expert.email_address || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Expertise Area</div>
                <div>{expert.expertise_area || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Experience</div>
                <div>{expert.experience_years ? `${expert.experience_years} years` : '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Core Group</div>
                <div>{expert.is_in_core_group ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                <div>{formatDate(expert.updated_at)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Biography</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="whitespace-pre-wrap">
                  {expert.bio || 'No biography available'}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents">
          <ExpertDocumentList
            expertId={expert.id}
            onSelectDocument={onSelectDocument}
            onAddDocument={onAddDocument}
            onEditDocument={onEditDocument}
            onDeleteDocument={onDeleteDocument}
            onProcessDocument={onProcessDocument}
          />
        </TabsContent>
        
        <TabsContent value="enhanced" className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jsonView ? (
            <Card>
              <CardHeader>
                <CardTitle>Enhanced Profile JSON</CardTitle>
                <CardDescription>Raw data extracted from documents</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <pre className="text-xs font-mono p-4 bg-muted rounded-md">
                    {JSON.stringify(enhancedProfile, null, 2) || 'No enhanced profile data available'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!enhancedProfile ? (
                <Card className="md:col-span-2">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <div className="mb-2">No enhanced profile data available</div>
                    <Button variant="outline" onClick={() => onProcessDocument} size="sm">
                      Process Documents
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Name</div>
                        <div>{enhancedProfile.name || '-'}</div>
                      </div>
                      {enhancedProfile.title && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Title</div>
                          <div>{enhancedProfile.title}</div>
                        </div>
                      )}
                      {enhancedProfile.affiliations && enhancedProfile.affiliations.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Affiliations</div>
                          <ul className="list-disc list-inside">
                            {enhancedProfile.affiliations.map((affiliation, i) => (
                              <li key={i}>{affiliation}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {enhancedProfile.contact && (
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Contact</div>
                          {enhancedProfile.contact.email && <div>Email: {enhancedProfile.contact.email}</div>}
                          {enhancedProfile.contact.phone && <div>Phone: {enhancedProfile.contact.phone}</div>}
                          {enhancedProfile.contact.website && <div>Website: {enhancedProfile.contact.website}</div>}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {enhancedProfile.education && enhancedProfile.education.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <GraduationCap className="h-5 w-5 mr-2" />
                          Education
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-56">
                          <div className="space-y-4">
                            {enhancedProfile.education.map((edu, i) => (
                              <div key={i} className="border-b pb-2 last:border-b-0">
                                <div className="font-medium">{edu.degree} in {edu.field}</div>
                                <div>{edu.institution}</div>
                                <div className="text-sm text-muted-foreground">{edu.year}</div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {enhancedProfile.experience && enhancedProfile.experience.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Briefcase className="h-5 w-5 mr-2" />
                          Professional Experience
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-56">
                          <div className="space-y-4">
                            {enhancedProfile.experience.map((exp, i) => (
                              <div key={i} className="border-b pb-2 last:border-b-0">
                                <div className="font-medium">{exp.role}</div>
                                <div>{exp.organization}</div>
                                <div className="text-sm text-muted-foreground">{exp.duration}</div>
                                <div className="mt-1 text-sm">{exp.description}</div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {enhancedProfile.publications && enhancedProfile.publications.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <BookOpen className="h-5 w-5 mr-2" />
                          Publications
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-56">
                          <div className="space-y-4">
                            {enhancedProfile.publications.map((pub, i) => (
                              <div key={i} className="border-b pb-2 last:border-b-0">
                                <div className="font-medium">{pub.title}</div>
                                <div>{pub.journal}</div>
                                <div className="text-sm text-muted-foreground">{pub.year}</div>
                                <div className="mt-1 text-sm">
                                  {pub.authors.join(', ')}
                                </div>
                                {pub.url && (
                                  <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-1 block">
                                    View Publication
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  {enhancedProfile.awards && enhancedProfile.awards.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Award className="h-5 w-5 mr-2" />
                          Awards & Honors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-56">
                          <div className="space-y-4">
                            {enhancedProfile.awards.map((award, i) => (
                              <div key={i} className="border-b pb-2 last:border-b-0">
                                <div className="font-medium">{award.title}</div>
                                <div className="text-sm">{award.organization}</div>
                                <div className="text-sm text-muted-foreground">{award.year}</div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}

                  <Card className={!enhancedProfile.expertise || enhancedProfile.expertise.length === 0 ? 'hidden' : ''}>
                    <CardHeader>
                      <CardTitle>Expertise & Skills</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {enhancedProfile.expertise?.map((skill, i) => (
                          <div key={i} className="bg-muted rounded-full px-3 py-1 text-sm">
                            {skill}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {enhancedProfile.research_areas && enhancedProfile.research_areas.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Research Areas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {enhancedProfile.research_areas.map((area, i) => (
                            <div key={i} className="bg-muted rounded-full px-3 py-1 text-sm">
                              {area}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {enhancedProfile.social_media && Object.values(enhancedProfile.social_media).some(v => v) && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Globe className="h-5 w-5 mr-2" />
                          Social Media & Online Presence
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {enhancedProfile.social_media.linkedin && (
                            <div className="flex items-center">
                              <span className="font-medium mr-2">LinkedIn:</span>
                              <a href={enhancedProfile.social_media.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {enhancedProfile.social_media.linkedin}
                              </a>
                            </div>
                          )}
                          {enhancedProfile.social_media.twitter && (
                            <div className="flex items-center">
                              <span className="font-medium mr-2">Twitter:</span>
                              <a href={enhancedProfile.social_media.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {enhancedProfile.social_media.twitter}
                              </a>
                            </div>
                          )}
                          {enhancedProfile.social_media.github && (
                            <div className="flex items-center">
                              <span className="font-medium mr-2">GitHub:</span>
                              <a href={enhancedProfile.social_media.github} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {enhancedProfile.social_media.github}
                              </a>
                            </div>
                          )}
                          {enhancedProfile.social_media.other && Object.entries(enhancedProfile.social_media.other).map(([key, value]) => (
                            <div key={key} className="flex items-center">
                              <span className="font-medium mr-2">{key}:</span>
                              <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {value}
                              </a>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {enhancedProfile.bio && (
                    <Card className="md:col-span-2">
                      <CardHeader>
                        <CardTitle>Biography</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64">
                          <div className="whitespace-pre-wrap">
                            {enhancedProfile.bio}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}