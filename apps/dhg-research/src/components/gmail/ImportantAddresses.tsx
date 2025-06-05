import { useState } from 'react';
import { Plus, Star, Trash2, Edit2, Save, X, Mail } from 'lucide-react';

interface ImportantAddress {
  id: string;
  email: string;
  importance: number;
  emailCount: number;
  lastEmail: Date;
}

const mockAddresses: ImportantAddress[] = [
  {
    id: '1',
    email: 'researcher@university.edu',
    importance: 3,
    emailCount: 156,
    lastEmail: new Date('2024-01-15'),
  },
  {
    id: '2',
    email: 'collaborator@research.org',
    importance: 2,
    emailCount: 89,
    lastEmail: new Date('2024-01-14'),
  },
  {
    id: '3',
    email: 'journal@sciencepub.com',
    importance: 1,
    emailCount: 23,
    lastEmail: new Date('2024-01-10'),
  },
];

function ImportantAddresses() {
  const [addresses, setAddresses] = useState(mockAddresses);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({ email: '', importance: 1 });
  const [editAddress, setEditAddress] = useState({ email: '', importance: 1 });

  const handleAdd = () => {
    if (newAddress.email) {
      const newId = Date.now().toString();
      setAddresses([...addresses, {
        id: newId,
        email: newAddress.email,
        importance: newAddress.importance,
        emailCount: 0,
        lastEmail: new Date(),
      }]);
      setNewAddress({ email: '', importance: 1 });
      setIsAdding(false);
    }
  };

  const handleEdit = (id: string) => {
    const address = addresses.find(a => a.id === id);
    if (address) {
      setEditAddress({ email: address.email, importance: address.importance });
      setEditingId(id);
    }
  };

  const handleSave = (id: string) => {
    setAddresses(addresses.map(a => 
      a.id === id 
        ? { ...a, email: editAddress.email, importance: editAddress.importance }
        : a
    ));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
  };

  const ImportanceStars = ({ level, onChange }: { level: number; onChange?: (level: number) => void }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          onClick={() => onChange?.(star)}
          disabled={!onChange}
          className={`${onChange ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <Star
            size={16}
            className={star <= level ? 'text-warning fill-warning' : 'text-text-muted'}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Important Email Addresses</h3>
          <p className="text-sm text-text-secondary mt-1">
            Manage addresses to prioritize for email syncing and processing
          </p>
        </div>
        
        <button
          onClick={() => setIsAdding(true)}
          className="btn btn-primary"
        >
          <Plus size={18} />
          <span>Add Address</span>
        </button>
      </div>

      {/* Add New Address Form */}
      {isAdding && (
        <div className="p-4 bg-background-elevated rounded-lg border border-border-light">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={newAddress.email}
                onChange={(e) => setNewAddress({ ...newAddress, email: e.target.value })}
                placeholder="researcher@example.com"
                className="input"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Importance
              </label>
              <ImportanceStars
                level={newAddress.importance}
                onChange={(level) => setNewAddress({ ...newAddress, importance: level })}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={handleAdd} className="btn btn-primary btn-sm">
                <Save size={16} />
              </button>
              <button onClick={() => setIsAdding(false)} className="btn btn-ghost btn-sm">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address List */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="table">
          <thead>
            <tr>
              <th>Email Address</th>
              <th>Importance</th>
              <th className="text-center">Email Count</th>
              <th>Last Email</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {addresses.map((address) => (
              <tr key={address.id}>
                <td>
                  {editingId === address.id ? (
                    <input
                      type="email"
                      value={editAddress.email}
                      onChange={(e) => setEditAddress({ ...editAddress, email: e.target.value })}
                      className="input input-sm"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-text-muted" />
                      <span className="font-medium">{address.email}</span>
                    </div>
                  )}
                </td>
                <td>
                  {editingId === address.id ? (
                    <ImportanceStars
                      level={editAddress.importance}
                      onChange={(level) => setEditAddress({ ...editAddress, importance: level })}
                    />
                  ) : (
                    <ImportanceStars level={address.importance} />
                  )}
                </td>
                <td className="text-center">
                  <span className="badge badge-primary">
                    {address.emailCount}
                  </span>
                </td>
                <td className="text-text-secondary">
                  {address.lastEmail.toLocaleDateString()}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    {editingId === address.id ? (
                      <>
                        <button
                          onClick={() => handleSave(address.id)}
                          className="p-1.5 rounded hover:bg-background-hover text-success"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded hover:bg-background-hover text-text-muted"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(address.id)}
                          className="p-1.5 rounded hover:bg-background-hover text-text-secondary"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(address.id)}
                          className="p-1.5 rounded hover:bg-background-hover text-error"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addresses.length === 0 && (
        <div className="text-center py-12">
          <Mail size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">No important addresses added yet</p>
          <p className="text-text-muted text-sm mt-1">
            Add email addresses to prioritize their emails for syncing
          </p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{addresses.length}</p>
          <p className="text-sm text-text-secondary">Total Addresses</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">
            {addresses.reduce((sum, a) => sum + a.emailCount, 0)}
          </p>
          <p className="text-sm text-text-secondary">Total Emails</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">
            {addresses.filter(a => a.importance === 3).length}
          </p>
          <p className="text-sm text-text-secondary">Critical Senders</p>
        </div>
      </div>
    </div>
  );
}

export default ImportantAddresses;