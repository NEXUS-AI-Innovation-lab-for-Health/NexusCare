import React from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import VideoCall from '../../components/VideoCall';

const MeetingCall: React.FC = () => {
    const { meetingId } = useParams<{ meetingId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as {
        mic?: boolean;
        cam?: boolean;
        videoDeviceId?: string;
        audioDeviceId?: string;
    } | null;

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            navigate('/login');
        }
    }, [navigate]);

    const handleLeave = () => {
        navigate('/meetings');
    };

    return (
        <VideoCall
            onLeave={handleLeave}
            initialMicOn={state?.mic ?? true}
            initialCamOn={state?.cam ?? true}
            initialVideoDeviceId={state?.videoDeviceId}
            initialAudioDeviceId={state?.audioDeviceId}
            meetingId={meetingId}
        />
    );
};

export default MeetingCall;
