const supabase = require('./src/config/database');

async function test() {
  const profile = {
    id: 'google-test-id-123456789',
    displayName: 'Test User',
    emails: [{ value: 'test_google_oauth@example.com' }],
    photos: [{ value: 'https://example.com/avatar.jpg' }]
  };
  const email = profile.emails[0].value;

  try {
    console.log('1. Finding user by Google ID...');
    const { data: userByGoogle, error: gError } = await supabase
      .from('users')
      .select('*, user_profiles(*)')
      .eq('googleId', profile.id)
      .maybeSingle();

    if (gError) console.error('gError:', gError);

    let user = userByGoogle;
    console.log('Found by Google ID:', user);

    if (!user) {
      console.log('2. Finding user by Email...');
      const { data: userByEmail, error: eError } = await supabase
        .from('users')
        .select('*, user_profiles(*)')
        .eq('email', email)
        .maybeSingle();

      if (eError) console.error('eError:', eError);
      console.log('Found by Email:', userByEmail);

      if (userByEmail) {
        console.log('3. Updating user with googleId...');
        const { data: updatedUser, error: uError } = await supabase
          .from('users')
          .update({ googleId: profile.id, updatedAt: new Date().toISOString() })
          .eq('id', userByEmail.id)
          .select('*, user_profiles(*)')
          .single();

        if (uError) console.error('uError:', uError);
        user = updatedUser;
      } else {
        console.log('4. Creating user...');
        const uuid = require('crypto').randomUUID();
        console.log('Generating User UUID:', uuid);
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: uuid,
            email,
            googleId: profile.id,
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
            updatedAt: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('createError:', createError);
          return;
        }

        console.log('Created user, ID:', newUser.id);

        console.log('5. Creating profile...');
        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: require('crypto').randomUUID(),
            userId: newUser.id,
            username,
            timezone: 'UTC',
            updatedAt: new Date().toISOString()
          });

        if (profileError) {
          console.error('profileError:', profileError);
          return;
        }

        console.log('6. Creating default event types...');
        const { error: etError } = await supabase
          .from('event_types')
          .insert([
            { id: require('crypto').randomUUID(), userId: newUser.id, title: '15 Min Meeting', slug: '15min', duration: 15, location: 'Google Meet', color: '#3b82f6', updatedAt: new Date().toISOString() },
            { id: require('crypto').randomUUID(), userId: newUser.id, title: '30 Min Meeting', slug: '30min', duration: 30, location: 'Zoom', color: '#10b981', updatedAt: new Date().toISOString() },
            { id: require('crypto').randomUUID(), userId: newUser.id, title: '60 Min Meeting', slug: '60min', duration: 60, location: 'In-person', color: '#f59e0b', updatedAt: new Date().toISOString() }
          ]);

        if (etError) {
          console.error('etError:', etError);
          return;
        }

        console.log('7. Creating default availability rules...');
        const { error: arError } = await supabase
          .from('availability_rules')
          .insert([
            { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
            { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
            { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
            { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() },
            { id: require('crypto').randomUUID(), userId: newUser.id, dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true, updatedAt: new Date().toISOString() }
          ]);

        if (arError) {
          console.error('arError:', arError);
          return;
        }

        console.log('8. Fetching fully created user...');
        const { data: fullUser, error: fetchError } = await supabase
          .from('users')
          .select('*, user_profiles(*)')
          .eq('id', newUser.id)
          .single();

        if (fetchError) {
          console.error('fetchError:', fetchError);
          return;
        }
        user = fullUser;
      }
    }

    console.log('OAuth test completed successfully! User is:', user);
  } catch (err) {
    console.error('Unexpected exception during OAuth test:', err);
  }
}

test();
